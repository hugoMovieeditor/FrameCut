"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import Header from "@/components/Header";
import FrameCard from "@/components/FrameCard";
import { useWallet } from "@/lib/useWallet";
import { ARCSCAN, switchToArc } from "@/lib/arcNetwork";
import { pickProvider } from "@/lib/wallet";
import {
  CONTRACT_ADDRESS,
  FRAMECUT_ABI,
  MAX,
  readContract,
  fetchStats,
  fetchFrames,
  fetchFramesOf,
  fetchCollectedBy,
  fetchOwned,
  fmtUsdc,
  shortAddr,
  type Frame,
  type Stats,
} from "@/lib/framecut";

function parseTimecode(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  let sec: number;
  if (t.includes(":")) {
    const parts = t.split(":");
    if (parts.length !== 2) return null;
    const [mm, ssRaw] = parts;
    // strict integers only — Number() would otherwise accept hex/exponent/decimal/empty
    if (!/^\d+$/.test(mm) || !/^\d{1,2}$/.test(ssRaw)) return null;
    const ss = Number(ssRaw);
    if (ss >= 60) return null;
    sec = Number(mm) * 60 + ss;
  } else {
    if (!/^\d+$/.test(t)) return null; // whole seconds only
    sec = Number(t);
  }
  const ms = sec * 1000;
  if (ms > 4294967295) return null;
  return ms;
}

export default function Home() {
  const { account, balance, chainOk, connecting, connect, disconnect, refreshBalance } = useWallet();

  const [stats, setStats] = useState<Stats>({ frames: 0n, collected: 0n, volume: 0n });
  const [frames, setFrames] = useState<Frame[]>([]);
  const [mine, setMine] = useState<Frame[]>([]);
  const [collected, setCollected] = useState<Frame[]>([]);
  const [tab, setTab] = useState<"all" | "mine" | "collected">("all");

  // cut form
  const [video, setVideo] = useState("");
  const [tc, setTc] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("0.5");
  const [cutMsg, setCutMsg] = useState("");
  const [cutting, setCutting] = useState(false);

  const [collectBusy, setCollectBusy] = useState<number | null>(null);
  const [collectMsg, setCollectMsg] = useState<Record<number, string>>({});
  const [owned, setOwned] = useState<Record<number, number>>({});

  // refs that survive re-renders: drop stale loads, ignore post-tx side effects after a
  // wallet change, block double-submits, and clean up per-frame "✓ Collected" timers.
  const loadEpoch = useRef(0);
  const accountRef = useRef(account);
  const collectInFlight = useRef(false);
  const cutInFlight = useRef(false);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
    };
  }, []);

  const load = useCallback(async () => {
    const myEpoch = ++loadEpoch.current;
    try {
      const c = readContract();
      const [s, fr] = await Promise.all([fetchStats(c), fetchFrames(c)]);
      if (myEpoch !== loadEpoch.current) return;
      setStats(s);
      setFrames(fr);
      if (account) {
        const [mn, col] = await Promise.all([fetchFramesOf(account, c), fetchCollectedBy(account, c)]);
        if (myEpoch !== loadEpoch.current) return;
        setMine(mn);
        setCollected(col);
        const ids = Array.from(new Set([...fr, ...mn, ...col].map((f) => f.id)));
        const ownedMap = await fetchOwned(ids, account, c);
        if (myEpoch !== loadEpoch.current) return;
        setOwned(ownedMap);
      } else {
        setMine([]);
        setCollected([]);
        setOwned({});
      }
    } catch {
      /* keep last good state */
    }
  }, [account]);

  useEffect(() => {
    load();
  }, [load]);

  async function writeContract() {
    const inj = pickProvider();
    if (!inj) throw new Error("No wallet found");
    await switchToArc(inj);
    const provider = new ethers.BrowserProvider(inj);
    const signer = await provider.getSigner(account);
    return new ethers.Contract(CONTRACT_ADDRESS, FRAMECUT_ABI, signer);
  }

  async function cut() {
    if (!account) {
      if (!pickProvider()) return setCutMsg("✗ No wallet detected — install Rabby or MetaMask");
      connect();
      return;
    }
    if (!/^https?:\/\/.+/.test(video.trim())) return setCutMsg("✗ Paste a valid video link");
    if (video.trim().length > 300) return setCutMsg("✗ Video link too long (max 300)");
    const ms = parseTimecode(tc);
    if (ms === null) return setCutMsg("✗ Timecode must be like 1:23 or 83");
    if (!title.trim()) return setCutMsg("✗ Name the frame");
    const p = price.trim();
    if (!p) return setCutMsg("✗ Set a price, or type 0 for a free frame");
    if (!/^\d+(\.\d{1,2})?$/.test(p)) return setCutMsg("✗ Price must be a plain amount, max 2 decimals (e.g. 0.5)");
    const pn = Number(p);
    if (pn > 0 && pn < 0.01) return setCutMsg("✗ Minimum paid price is 0.01 USDC (or type 0 for free)");
    if (cutInFlight.current) return;
    cutInFlight.current = true;
    const captured = account;
    setCutting(true);
    setCutMsg("Cutting… confirm in your wallet");
    try {
      const c = await writeContract();
      const priceWei = pn > 0 ? ethers.parseEther(p) : 0n;
      const tx = await c.cut(video.trim(), ms, title.trim(), priceWei);
      setCutMsg("Confirming on ARC…");
      await tx.wait();
      if (accountRef.current !== captured) return;
      setCutMsg("✓ Frame is on-chain");
      setVideo("");
      setTc("");
      setTitle("");
      await load();
    } catch (e) {
      const err = e as { code?: string | number; reason?: string; shortMessage?: string; message?: string };
      const why = err?.code === "ACTION_REJECTED" || err?.code === 4001
        ? "Cancelled"
        : (err?.reason || err?.shortMessage || err?.message || "Failed").slice(0, 70);
      setCutMsg("✗ " + why);
    } finally {
      cutInFlight.current = false;
      setCutting(false);
    }
  }

  async function collectFrame(id: number, priceWei: bigint) {
    if (!account) {
      if (!pickProvider()) return setCollectMsg((m) => ({ ...m, [id]: "✗ No wallet" }));
      connect();
      return;
    }
    if (collectInFlight.current) return; // synchronous re-entrancy guard (state lags a render)
    collectInFlight.current = true;
    const captured = account;
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    setCollectBusy(id);
    setCollectMsg((m) => ({ ...m, [id]: "Collecting…" }));
    try {
      const c = await writeContract();
      const tx = await c.collect(id, { value: priceWei });
      await tx.wait();
      if (accountRef.current !== captured) return; // wallet changed/disconnected mid-tx
      await load();
      if (accountRef.current !== captured) return;
      await refreshBalance(captured);
      setCollectMsg((m) => ({ ...m, [id]: "✓ Collected" }));
      timers.current[id] = setTimeout(() => {
        setCollectMsg((m) => { const n = { ...m }; delete n[id]; return n; });
        delete timers.current[id];
      }, 2500);
    } catch (e) {
      const err = e as { code?: string | number; reason?: string; shortMessage?: string; message?: string };
      const why = err?.code === "ACTION_REJECTED" || err?.code === 4001
        ? "Cancelled"
        : (err?.reason || err?.shortMessage || err?.message || "Failed").slice(0, 70);
      setCollectMsg((m) => ({ ...m, [id]: "✗ " + why }));
    } finally {
      collectInFlight.current = false;
      setCollectBusy(null);
    }
  }

  const wrap: React.CSSProperties = { maxWidth: 1180, margin: "0 auto", padding: "0 22px" };
  const list = tab === "all" ? frames : tab === "mine" ? mine : collected;

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 70 }}>
      <Header account={account} balance={balance} chainOk={chainOk} connecting={connecting} onConnect={connect} onDisconnect={disconnect} />

      <>
          {/* ── hero: the content-machine canvas headline ── */}
          <section style={{ ...wrap, paddingTop: 64, paddingBottom: 18, position: "relative" }}>
            {/* decorative floating canvas: dashed connectors between sample source nodes */}
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
              <svg className="connectors" viewBox="0 0 1180 520" preserveAspectRatio="none">
                <path className="lit" d="M150 120 C 320 120, 360 300, 540 300" />
                <path d="M540 300 C 760 300, 800 110, 1000 110" />
                <path d="M150 120 C 280 240, 300 420, 470 440" />
                <path className="lit" d="M1000 110 C 1080 240, 980 400, 820 440" />
                <circle className="node" cx="150" cy="120" r="5" />
                <circle className="node" cx="540" cy="300" r="5" />
                <circle className="node" cx="1000" cy="110" r="5" />
                <circle className="node" cx="470" cy="440" r="5" />
                <circle className="node" cx="820" cy="440" r="5" />
              </svg>
            </div>

            <div style={{ position: "relative", zIndex: 1, maxWidth: 760 }}>
              <span className="chip splice-in" style={{ marginBottom: 22 }}>
                <span className="dot" /> ARC Testnet · native USDC
              </span>
              <h1 className="display splice-in" style={{ fontSize: "clamp(46px, 8vw, 96px)", marginTop: 20 }}>
                Cut one frame.
                <br />
                <span className="display-2">Mint the moment.</span>
              </h1>
              <p className="splice-in" style={{ fontSize: 17, color: "var(--ink-2)", maxWidth: 540, lineHeight: 1.6, marginTop: 24 }}>
                A canvas of video sources. Pick a timestamp, cut that single frame, and wire it on-chain.
                Collectors grab an edition for a few cents of USDC — and it pays you the instant they do.
              </p>
              <div className="splice-in" style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap", alignItems: "center" }}>
                <a href="#cut" className="btn btn--primary" style={{ padding: "13px 24px" }}>
                  Cut a frame <span className="arrow">→</span>
                </a>
                <a href="#canvas" className="btn btn--ghost">Browse the canvas</a>
                {/* floating circular node button */}
                <a href="#cut" aria-label="Add a node" className="node-btn anim-drift" style={{ textDecoration: "none", marginLeft: 4 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </a>
              </div>
            </div>

            {/* stats — three connected readouts */}
            <div className="fc-stats splice-in" style={{ marginTop: 52, position: "relative", zIndex: 1 }}>
              {[
                { k: "Frames cut", v: stats.frames.toString() },
                { k: "Editions collected", v: stats.collected.toString() },
                { k: "USDC paid out", v: "$" + fmtUsdc(stats.volume) },
              ].map((s) => (
                <div key={s.k} className="panel" style={{ padding: "20px 22px" }}>
                  <div className="display" style={{ fontSize: "clamp(26px, 6vw, 40px)", overflowWrap: "anywhere", fontWeight: 400 }}>{s.v}</div>
                  <div className="tag" style={{ marginTop: 8 }}>{s.k}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── cut form: add a source node ── */}
          <section id="cut" style={{ ...wrap, marginTop: 40 }}>
            <div className="panel">
              <div style={{ padding: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <span className="dot" style={{ background: "var(--bad)", boxShadow: "0 0 8px var(--bad)" }} />
                  <span className="tag" style={{ color: "var(--ink-2)" }}>New node — cut a frame onto the canvas</span>
                </div>
                <div className="fc-cut2" style={{ marginBottom: 12 }}>
                  <div>
                    <label className="tag" style={{ display: "block", marginBottom: 7 }}>Video link</label>
                    <input value={video} onChange={(e) => setVideo(e.target.value)} maxLength={300} placeholder="https://youtube.com/…" className="input" disabled={!account} />
                  </div>
                  <div>
                    <label className="tag" style={{ display: "block", marginBottom: 7 }}>Timecode</label>
                    <input value={tc} onChange={(e) => setTc(e.target.value)} placeholder="1:23  or  83" className="input" disabled={!account} />
                  </div>
                </div>
                <div className="fc-cut3">
                  <div>
                    <label className="tag" style={{ display: "block", marginBottom: 7 }}>Frame title</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="The look, act III" className="input" disabled={!account} />
                  </div>
                  <div>
                    <label className="tag" style={{ display: "block", marginBottom: 7 }}>Price / edition (USDC)</label>
                    <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.5" className="input" disabled={!account} />
                  </div>
                  {account ? (
                    <button onClick={cut} disabled={cutting} className="btn btn--primary" style={{ height: 44 }}>{cutting ? "Cutting…" : "Cut frame"}</button>
                  ) : (
                    <button onClick={connect} className="btn btn--primary" style={{ height: 44 }}>Connect</button>
                  )}
                </div>
                {cutMsg && (
                  <div className="mono" style={{ marginTop: 14, fontSize: 12, color: cutMsg.startsWith("✓") ? "var(--ok)" : cutMsg.startsWith("✗") ? "var(--bad)" : "var(--muted)" }}>{cutMsg}</div>
                )}
              </div>
            </div>
          </section>

          {/* ── canvas: the connected source-cards ── */}
          <section id="canvas" style={{ ...wrap, marginTop: 56 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <div className="tag" style={{ marginBottom: 10 }}>The canvas</div>
                <h2 className="display" style={{ fontSize: "clamp(30px, 5vw, 46px)", fontWeight: 300 }}>Connected sources</h2>
              </div>
              <div style={{ display: "inline-flex", padding: 4, gap: 4, borderRadius: 999, border: "1px solid var(--line)", background: "var(--bg-2)" }}>
                {([["all", "All"], ["mine", "Yours"], ["collected", "Collected"]] as const).map(([t, lbl]) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="mono"
                    style={{ padding: "8px 15px", border: "none", borderRadius: 999, background: tab === t ? "var(--ink)" : "transparent", color: tab === t ? "#16171a" : "var(--muted)", cursor: "pointer", fontSize: 11.5, letterSpacing: "0.04em", fontWeight: tab === t ? 600 : 400, transition: "background 0.18s ease, color 0.18s ease" }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {!account && tab !== "all" ? (
              <div className="panel" style={{ padding: 48, textAlign: "center" }}><span className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>Connect your wallet to see this.</span></div>
            ) : list.length === 0 ? (
              <div className="panel" style={{ padding: 48, textAlign: "center" }}><span className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>{tab === "all" ? "No frames on the canvas yet. Be the first ↑" : tab === "mine" ? "You haven't cut a frame yet." : "Nothing collected yet."}</span></div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(228px, 1fr))", gap: 18 }}>
                  {list.map((f) => (
                    <FrameCard key={f.id} frame={f} me={account} owned={owned[f.id] ?? 0} busy={collectBusy === f.id} msg={collectMsg[f.id]} onCollect={collectFrame} />
                  ))}
                </div>
                {tab === "all" && frames.length < Number(stats.frames) && (
                  <div className="mono" style={{ marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
                    Showing the latest {frames.length} of {stats.frames.toString()} frames.
                  </div>
                )}
                {tab !== "all" && list.length >= MAX && (
                  <div className="mono" style={{ marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
                    Showing the latest {MAX}. Older frames aren&apos;t listed here.
                  </div>
                )}
              </>
            )}
          </section>

          {/* ── why ARC ── */}
          <section id="arc" style={{ ...wrap, marginTop: 64 }}>
            <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "30px 30px 26px", borderBottom: "1px solid var(--line)" }}>
                <div className="tag" style={{ marginBottom: 14 }}>The Arc layer</div>
                <h2 className="display" style={{ fontSize: "clamp(26px,4vw,44px)", maxWidth: 720, fontWeight: 300 }}>A 30-cent sale only works if it&apos;s actually instant and free to move.</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))" }}>
                {[
                  { n: "01", t: "Collecting is a USDC micro-payment", d: "Editions cost cents, priced in plain dollars. ARC settles in native USDC, so there's no token to buy and no approval to sign." },
                  { n: "02", t: "The creator gets paid on the spot", d: "The moment a fan collects, the USDC lands in your wallet in the same transaction. No platform float, no payout you chase." },
                  { n: "03", t: "Every cut is on the record", d: "Source video, exact timecode, price and every edition — all on-chain and readable by anyone on ArcScan." },
                ].map((row, i) => (
                  <div key={row.n} style={{ padding: "26px 26px", borderLeft: i ? "1px solid var(--line)" : "none" }}>
                    <div className="mono" style={{ fontSize: 13, color: "var(--glow)", marginBottom: 12, letterSpacing: "0.1em" }}>{row.n}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 9, lineHeight: 1.25, letterSpacing: "-0.01em" }}>{row.t}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{row.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* footer */}
          <footer style={{ ...wrap, marginTop: 48 }}>
            <div className="mono" style={{ borderTop: "1px solid var(--line)", paddingTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 11, letterSpacing: "0.05em" }}>
              <span style={{ color: "var(--muted)" }}>FrameCut · ARC Testnet</span>
              <a href={`${ARCSCAN}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink-2)", textDecoration: "none" }}>
                Verified contract {shortAddr(CONTRACT_ADDRESS, 8, 6)} ↗
              </a>
            </div>
          </footer>
      </>
    </div>
  );
}
