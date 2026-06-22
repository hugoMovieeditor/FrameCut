// Multi-wallet discovery via EIP-6963.
//
// With several extensions installed (Rabby, MetaMask, OKX, Phantom, …) they all
// scribble over window.ethereum and requests start getting dropped. The 6963
// handshake has every wallet announce itself, so we can lock onto one specific
// provider (Rabby by default) rather than trusting window.ethereum — and reuse
// that exact instance for reads, writes and event subscriptions alike.

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isRabby?: boolean;
  isMetaMask?: boolean;
}

interface ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
}

// Wallets we'd rather land on, in descending order of preference.
const RANKED_RDNS = ["io.rabby", "io.metamask"];

// localStorage slot holding the rdns of the wallet the user pinned. Built from
// a namespace + suffix pair so it reads distinctly from the disconnect flag.
const PIN_NAMESPACE = "fc:wallet";
const PIN_SLOT = `${PIN_NAMESPACE}/pinned-rdns`;

// Providers collected from announce events so far.
const seen: ProviderDetail[] = [];

function remember(detail?: ProviderDetail) {
  if (!detail?.info?.rdns || !detail.provider) return;
  const at = seen.findIndex((d) => d.info.rdns === detail.info.rdns);
  if (at === -1) seen.push(detail);
  else seen[at] = detail;
}

if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (e: Event) => {
    remember((e as CustomEvent<ProviderDetail>).detail);
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

// --- pinned-choice persistence ------------------------------------------------

export function getChosenRdns(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(PIN_SLOT) || "";
  } catch {
    return "";
  }
}

export function setChosenRdns(rdns: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PIN_SLOT, rdns);
  } catch {
    /* storage unavailable — non-fatal */
  }
}

// --- announce / discovery helpers ---------------------------------------------

export function refreshWallets() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("eip6963:requestProvider"));
}

/** Resolve once at least one wallet has announced (or a short timeout). */
export function ensureDiscovered(timeoutMs = 250): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (seen.length) {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let settled = false;
    const onAnnounce = () => finish();
    function finish() {
      if (settled) return;
      settled = true;
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      resolve();
    }
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(finish, timeoutMs);
  });
}

export function listWallets() {
  refreshWallets();
  return seen.map((d) => ({ name: d.info.name, rdns: d.info.rdns, icon: d.info.icon }));
}

// --- provider selection -------------------------------------------------------

/** Best matching provider detail — pinned choice, then preference, then any. */
export function pickDetail(rdns?: string): { provider: Eip1193Provider; rdns: string } | undefined {
  refreshWallets();
  const target = rdns ?? getChosenRdns();
  if (target) {
    const hit = seen.find((d) => d.info.rdns === target);
    if (hit) return { provider: hit.provider, rdns: hit.info.rdns };
  }
  for (const candidate of RANKED_RDNS) {
    const hit = seen.find((d) => d.info.rdns === candidate);
    if (hit) return { provider: hit.provider, rdns: hit.info.rdns };
  }
  const fallback = seen[0];
  if (fallback) return { provider: fallback.provider, rdns: fallback.info.rdns };
  return undefined;
}

/** Best injected provider. Defaults to the pinned wallet, then Rabby/MetaMask. */
export function pickProvider(rdns?: string): Eip1193Provider | undefined {
  const d = pickDetail(rdns);
  if (d) return d.provider;
  return typeof window !== "undefined" ? (window.ethereum as Eip1193Provider | undefined) : undefined;
}
