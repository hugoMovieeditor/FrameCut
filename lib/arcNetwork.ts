import { pickProvider, type Eip1193Provider } from "./wallet";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

// --- ARC Testnet chain constants ---------------------------------------------
export const ARC_CHAIN_ID = 5042002;
export const ARC_CHAIN_HEX = "0x" + ARC_CHAIN_ID.toString(16);
export const ARC_RPC = "https://rpc.testnet.arc.network";
export const ARCSCAN = "https://testnet.arcscan.app";

// Shape expected by wallet_addEthereumChain.
export const ARC_NETWORK_PARAMS = {
  chainId: ARC_CHAIN_HEX,
  chainName: "ARC Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: [ARC_RPC],
  blockExplorerUrls: [ARCSCAN],
};

/**
 * Register ARC Testnet with the wallet (a no-op if it already knows it) and
 * switch the active chain to it. Acts on the given provider, otherwise the best
 * discovered one (Rabby first).
 */
export async function switchToArc(provider?: Eip1193Provider): Promise<void> {
  const eth = provider ?? pickProvider();
  if (!eth) throw new Error("No wallet detected");

  // Add first — harmless to call when the chain is already registered.
  try {
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [ARC_NETWORK_PARAMS],
    });
  } catch {
    // Certain wallets reject re-adding an existing chain — safe to swallow.
  }

  // Now force the switch.
  await eth.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: ARC_CHAIN_HEX }],
  });
}
