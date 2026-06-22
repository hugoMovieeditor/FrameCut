"use client";

import { ethers } from "ethers";
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureDiscovered, pickDetail, pickProvider, setChosenRdns, type Eip1193Provider } from "./wallet";
import { ARC_CHAIN_HEX, ARC_RPC, switchToArc } from "./arcNetwork";

// Flag persisted in localStorage when the user explicitly disconnects, so we
// don't silently re-attach on the next page load. Keyed off the same wallet
// namespace but with its own action suffix.
const SESSION_FLAG = "fc:wallet/session-cleared";

/**
 * Single source of truth for wallet state. Discovers wallets via EIP-6963
 * (Rabby first), pins the chosen one, and binds account/chain listeners to the
 * exact provider in use — re-subscribing whenever connect() picks a (possibly
 * different) wallet. Supports an explicit disconnect that survives reloads.
 */
export function useWallet() {
  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("");
  const [chainOk, setChainOk] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const clearedRef = useRef(false);
  const bindingRef = useRef<{ provider: Eip1193Provider; cleanup: () => void } | null>(null);

  const chainMatches = (id: unknown) =>
    (id as string).toLowerCase() === ARC_CHAIN_HEX.toLowerCase();

  const refreshBalance = useCallback(async (addr: string) => {
    try {
      const rpc = new ethers.JsonRpcProvider(ARC_RPC);
      const wei = await rpc.getBalance(addr);
      setBalance(parseFloat(ethers.formatEther(wei)).toFixed(3));
    } catch {
      setBalance("—");
    }
  }, []);

  // Attach account/chain listeners to one specific provider, detaching whatever
  // was wired up before. Idempotent for the same provider instance.
  const subscribe = useCallback(
    (inj: Eip1193Provider) => {
      if (!inj?.on) return;
      if (bindingRef.current?.provider === inj) return;
      bindingRef.current?.cleanup();

      const handleAccounts = (a: unknown) => {
        if (clearedRef.current) return;
        const list = a as string[];
        if (list.length) {
          setAccount(list[0]);
          refreshBalance(list[0]);
        } else {
          setAccount("");
          setBalance("");
          setChainOk(false);
        }
      };
      const handleChain = (c: unknown) => setChainOk(chainMatches(c));

      inj.on("accountsChanged", handleAccounts);
      inj.on("chainChanged", handleChain);
      bindingRef.current = {
        provider: inj,
        cleanup: () => {
          inj.removeListener?.("accountsChanged", handleAccounts);
          inj.removeListener?.("chainChanged", handleChain);
        },
      };
    },
    [refreshBalance]
  );

  const connect = useCallback(async () => {
    clearedRef.current = false;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(SESSION_FLAG);
      } catch {
        /* ignore */
      }
    }
    await ensureDiscovered();
    const detail = pickDetail();
    const inj = detail?.provider;
    if (!inj) return;
    setChosenRdns(detail.rdns);
    setConnecting(true);
    try {
      const accs = (await inj.request({ method: "eth_requestAccounts" })) as string[];
      if (!accs?.length) return;
      setAccount(accs[0]);
      subscribe(inj); // listen to the wallet we actually connected to
      try {
        await switchToArc(inj);
      } catch {
        /* user declined the network switch — still finish connecting */
      }
      try {
        const id = (await inj.request({ method: "eth_chainId" })) as string;
        setChainOk(chainMatches(id));
      } catch {
        setChainOk(false);
      }
      refreshBalance(accs[0]);
    } catch {
      /* user rejected the connection */
    } finally {
      setConnecting(false);
    }
  }, [refreshBalance, subscribe]);

  const disconnect = useCallback(() => {
    clearedRef.current = true;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(SESSION_FLAG, "1");
      } catch {
        /* ignore */
      }
    }
    setAccount("");
    setBalance("");
    setChainOk(false);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem(SESSION_FLAG) === "1") {
      clearedRef.current = true;
    }
    (async () => {
      await ensureDiscovered();
      const inj = pickProvider();
      if (!inj) return;
      if (!clearedRef.current) {
        try {
          const accs = (await inj.request({ method: "eth_accounts" })) as string[];
          if (accs.length) {
            setAccount(accs[0]);
            refreshBalance(accs[0]);
            inj
              .request({ method: "eth_chainId" })
              .then((id) => setChainOk(chainMatches(id)))
              .catch(() => {});
          }
        } catch {
          /* ignore */
        }
      }
      subscribe(inj);
    })();
    return () => {
      bindingRef.current?.cleanup();
      bindingRef.current = null;
    };
  }, [refreshBalance, subscribe]);

  return { account, balance, chainOk, connecting, connect, disconnect, refreshBalance };
}
