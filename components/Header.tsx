"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { ARCSCAN, switchToArc } from "@/lib/arcNetwork";

interface HeaderProps {
  account: string;
  balance: string;
  chainOk: boolean;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export default function Header({ account, balance, chainOk, connecting, onConnect, onDisconnect }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--paper)", borderBottom: "2px solid var(--ink)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "12px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none" }}>
          <Logo size={26} />
          <span className="mono" style={{ fontSize: 17, fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase" }}>
            Frame<span style={{ color: "var(--red)" }}>Cut</span>
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {account ? (
            <>
              {!chainOk && (
                <button onClick={() => switchToArc().catch(() => {})} className="btn btn--sm" style={{ borderColor: "var(--red)", color: "var(--red)" }}>
                  Wrong net — switch
                </button>
              )}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setOpen((o) => !o)}
                  className="box"
                  style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "8px 12px", fontFamily: "'Space Mono', monospace", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--ink)" }}
                >
                  <span style={{ width: 8, height: 8, background: chainOk ? "var(--ink)" : "var(--red)", flexShrink: 0 }} />
                  <span>{balance || "0"} USDC</span>
                  <span style={{ width: 2, height: 13, background: "var(--ink)" }} />
                  <span>{account.slice(0, 5)}…{account.slice(-3)}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ transform: open ? "rotate(180deg)" : "none" }}>
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
                  </svg>
                </button>

                {open && (
                  <>
                    <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
                    <div className="box" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 61, minWidth: 220, background: "var(--paper)", boxShadow: "5px 5px 0 var(--ink)" }}>
                      <div style={{ padding: "10px 13px" }}>
                        <div className="tag" style={{ color: "var(--muted)", marginBottom: 4 }}>Connected</div>
                        <div className="mono" style={{ fontSize: 12.5 }}>{account.slice(0, 12)}…{account.slice(-8)}</div>
                      </div>
                      <button className="fc-mi" onClick={copy}>{copied ? "Copied!" : "Copy address"}</button>
                      <a className="fc-mi" href={`${ARCSCAN}/address/${account}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>View on ArcScan ↗</a>
                      <button className="fc-mi danger" onClick={() => { setOpen(false); onDisconnect(); }}>Disconnect</button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <button onClick={onConnect} disabled={connecting} className="btn btn--red">
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </div>
      </div>
      <div className="filmstrip" />
    </header>
  );
}
