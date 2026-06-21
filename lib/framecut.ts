import { ethers } from "ethers";
import { ARC_RPC } from "./arcNetwork";

// ─────────────────────────────────────────────────────────────
// FrameCut — cut a frame from a video, mint it, collect editions in USDC.
// One deployed, verified contract — the single source of truth.
// ─────────────────────────────────────────────────────────────
export const CONTRACT_ADDRESS = "0xfDB1576dcA70CCfdCeA58f845b6A20c7afE4E6D9";

export const FRAMECUT_ABI = [
  "function frameCount() view returns (uint256)",
  "function totalCollected() view returns (uint256)",
  "function totalVolume() view returns (uint256)",
  "function editionsOwned(uint256, address) view returns (uint256)",
  "function framesOf(address) view returns (uint256[])",
  "function collectedBy(address) view returns (uint256[])",
  "function getFrame(uint256) view returns (tuple(uint256 id, address creator, string video, uint32 atMs, string title, uint256 price, uint256 editions, uint64 cutAt))",
  "function cut(string video, uint32 atMs, string title, uint256 price) returns (uint256)",
  "function collect(uint256 id) payable",
  "event Cut(uint256 indexed id, address indexed creator, string video, uint32 atMs, string title, uint256 price)",
  "event Collected(uint256 indexed id, address indexed collector, address indexed creator, uint256 edition, uint256 price)",
];

export interface Frame {
  id: number;
  creator: string;
  video: string;
  atMs: number;
  title: string;
  price: bigint;
  editions: number;
  cutAt: number;
}

export interface Stats {
  frames: bigint;
  collected: bigint;
  volume: bigint;
}

// ── read helpers ──────────────────────────────────────────────
export function readProvider() {
  return new ethers.JsonRpcProvider(ARC_RPC);
}

export function readContract(provider?: ethers.Provider) {
  return new ethers.Contract(CONTRACT_ADDRESS, FRAMECUT_ABI, provider ?? readProvider());
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  const failed: T[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const settled = await Promise.allSettled(batch.map(fn));
    settled.forEach((s, j) => (s.status === "fulfilled" ? out.push(s.value) : failed.push(batch[j])));
  }
  const stillFailed: T[] = [];
  for (let i = 0; i < failed.length; i += limit) {
    const batch = failed.slice(i, i + limit);
    const settled = await Promise.allSettled(batch.map(fn));
    settled.forEach((s, j) => (s.status === "fulfilled" ? out.push(s.value) : stillFailed.push(batch[j])));
  }
  if (stillFailed.length) console.warn(`framecut: ${stillFailed.length} read(s) failed after retry`);
  return out;
}

function toFrame(f: {
  id: bigint;
  creator: string;
  video: string;
  atMs: bigint | number;
  title: string;
  price: bigint;
  editions: bigint | number;
  cutAt: bigint | number;
}): Frame {
  return {
    id: Number(f.id),
    creator: f.creator,
    video: f.video,
    atMs: Number(f.atMs),
    title: f.title,
    price: f.price,
    editions: Number(f.editions),
    cutAt: Number(f.cutAt),
  };
}

export async function fetchStats(contract?: ethers.Contract): Promise<Stats> {
  const c = contract ?? readContract();
  const [frames, collected, volume] = await Promise.all([c.frameCount(), c.totalCollected(), c.totalVolume()]);
  return { frames, collected, volume };
}

const MAX = 120;

export async function fetchFrames(contract?: ethers.Contract): Promise<Frame[]> {
  const c = contract ?? readContract();
  const count = Number(await c.frameCount());
  if (!count) return [];
  const start = Math.max(1, count - MAX + 1);
  const ids: number[] = [];
  for (let i = count; i >= start; i--) ids.push(i);
  const raw = await mapLimit(ids, 10, async (id) => toFrame(await c.getFrame(id)));
  raw.sort((a, b) => b.id - a.id);
  return raw;
}

export async function fetchFramesOf(addr: string, contract?: ethers.Contract): Promise<Frame[]> {
  const c = contract ?? readContract();
  const ids: bigint[] = await c.framesOf(addr);
  const raw = await mapLimit(ids.slice(-MAX).map(Number), 10, async (id) => toFrame(await c.getFrame(id)));
  raw.sort((a, b) => b.id - a.id);
  return raw;
}

export async function fetchCollectedBy(addr: string, contract?: ethers.Contract): Promise<Frame[]> {
  const c = contract ?? readContract();
  const ids: bigint[] = await c.collectedBy(addr);
  const raw = await mapLimit(ids.slice(-MAX).map(Number), 10, async (id) => toFrame(await c.getFrame(id)));
  raw.sort((a, b) => b.id - a.id);
  return raw;
}

export async function fetchFrame(id: number, contract?: ethers.Contract): Promise<Frame | null> {
  const c = contract ?? readContract();
  try {
    const f = toFrame(await c.getFrame(id));
    return f.creator === ethers.ZeroAddress ? null : f;
  } catch {
    return null;
  }
}

/** How many editions `addr` owns of each given frame id (only non-zero entries). */
export async function fetchOwned(ids: number[], addr: string, contract?: ethers.Contract): Promise<Record<number, number>> {
  if (!addr || ids.length === 0) return {};
  const c = contract ?? readContract();
  const map: Record<number, number> = {};
  await mapLimit(ids, 10, async (id) => {
    const n = Number(await c.editionsOwned(id, addr));
    if (n > 0) map[id] = n;
    return n;
  });
  return map;
}

// ── formatting / video ────────────────────────────────────────
export function shortAddr(addr: string, lead = 6, tail = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

export function fmtUsdc(wei: bigint, dp = 2): string {
  const n = parseFloat(ethers.formatEther(wei));
  if (n === 0) return "0";
  if (n < 0.01) return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  const s = n.toFixed(dp);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

export function timeAgo(unixSeconds: number): string {
  if (!unixSeconds) return "";
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 0) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** milliseconds -> "m:ss" or "m:ss.cc" timecode */
export function fmtTimecode(ms: number): string {
  const cs = Math.round(ms / 10); // centiseconds, rounded up front
  const m = Math.floor(cs / 6000);
  const sInt = Math.floor((cs % 6000) / 100);
  const frac = cs % 100;
  const base = `${m}:${String(sInt).padStart(2, "0")}`;
  return frac > 0 ? `${base}.${String(frac).padStart(2, "0")}` : base;
}

export interface VideoMeta {
  kind: "youtube" | "vimeo" | "link";
  id: string;
  thumb: string;
  href: string;
}

export function parseVideo(url: string, atMs = 0): VideoMeta {
  const u = (url || "").trim();
  const sec = Math.floor(atMs / 1000);
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) {
    return {
      kind: "youtube",
      id: yt[1],
      thumb: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`,
      href: `https://www.youtube.com/watch?v=${yt[1]}${sec ? `&t=${sec}s` : ""}`,
    };
  }
  const vm = u.match(/(?:^|\/\/|\.)vimeo\.com\/(?:[\w-]+\/)*(?:video\/)?(\d+)/);
  if (vm) {
    const tm = Math.floor(sec / 60);
    const ts = sec % 60;
    return { kind: "vimeo", id: vm[1], thumb: "", href: `https://vimeo.com/${vm[1]}${sec ? `#t=${tm}m${ts}s` : ""}` };
  }
  return { kind: "link", id: "", thumb: "", href: u };
}
