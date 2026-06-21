"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import Header from "@/components/Header";
import FrameCard from "@/components/FrameCard";
import { useWallet } from "@/lib/useWallet";
import { ARCSCAN, switchToArc } from "@/lib/arcNetwork";
import { pickProvider } from "@/lib/wallet";
import {
  CONTRACT_ADDRESS,
  FRAMECUT_ABI,
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
    const m = Number(parts[0]);
    const ss = Number(parts[1]);
    if (!isFinite(m) || !isFinite(ss) || m < 0 || ss < 0 || ss >= 60) return null;
    sec = m * 60 + ss;
  } else {
    sec = Number(t);
    if (!isFinite(sec) || sec < 0) return null;
  }
  const ms = Math.round(sec * 1000);
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

  const load = useCallback(async () => {
    try {
      const c = readContract();
      const [s, fr] = await Promise.all([fetchStats(c), fetchFrames(c)]);
      setStats(s);
      setFrames(fr);
      if (account) {
        const [mn, col] = await Promise.all([fetchFramesOf(account, c), fetchCollectedBy(account, c)]);
        setMine(mn);
        setCollected(col);
        const ids = Array.from(new Set([...fr, ...mn, ...col].map((f) => f.id)));
        setOwned(await fetchOwned(ids, account, c));
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
    if (p && !/^\d+(\.\d{1,18})?$/.test(p)) return setCutMsg("✗ Price must be a plain amount, e.g. 0.5");
    setCutting(true);
    setCutMsg("Cutting… confirm in your wallet");
    try {
      const c = await writeContract();
      const priceWei = p && Number(p) > 0 ? ethers.parseEther(p) : 0n;
      const tx = await c.cut(video.trim(), ms, title.trim(), priceWei);
      setCutMsg("Confirming on ARC…");
      await tx.wait();
      setCutMsg("✓ Frame is on-chain");
      setVideo("");
      setTc("");
      setTitle("");
      await load();
    } catch (e) {
      const err = e as { code?: string | number; message?: string };
      setCutMsg("✗ " + (err?.code === "ACTION_REJECTED" || err?.code === 4001 ? "Cancelled" : err?.message?.slice(0, 70) || "Failed"));
    } finally {
      setCutting(false);
    }
  }

  async function collectFrame(id: number, priceWei: bigint) {
    if (!account) {
      if (!pickProvider()) return setCollectMsg((m) => ({ ...m, [id]: "✗ No wallet" }));
      connect();
      return;
    }
    setCollectBusy(id);
    setCollectMsg((m) => ({ ...m, [id]: "Collecting…" }));
    try {
      const c = await writeContract();
      const tx = await c.collect(id, { value: priceWei });
      await tx.wait();
      await load();
      if (account) await refreshBalance(account);
      setCollectMsg((m) => ({ ...m, [id]: "✓ Collected" }));
      setTimeout(() => setCollectMsg((m) => { const n = { ...m }; delete n[id]; return n; }), 2500);
    } catch (e) {
      const err = e as { code?: string | number; message?: string };
      setCollectMsg((m) => ({ ...m, [id]: "✗ " + (err?.code === "ACTION_REJECTED" || err?.code === 4001 ? "Cancelled" : "Failed") }));
    } finally {
      setCollectBusy(null);
    }
  }

  const wrap: React.CSSProperties = { maxWidth: 1240, margin: "0 auto", padding: "0 22px" };
  const list = tab === "all" ? frames : tab === "mine" ? mine : collected;

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 60 }}>
      <Header account={account} balance={balance} chainOk={chainOk} connecting={connecting} onConnect={connect} onDisconnect={disconnect} />

      <>
          {/* hero */}
          <section style={{ ...wrap, paddingTop: 44, paddingBottom: 30 }}>
            <div className="tag" style={{ color: "var(--muted)", marginBottom: 18 }}>Cut a frame · mint it · ARC Testnet</div>
            <h1 className="display" style={{ fontSize: "clamp(44px, 7.5vw, 104px)" }}>Cut a frame.</h1>
            <h1 className="display" style={{ fontSize: "clamp(44px, 7.5vw, 104px)", color: "var(--red)" }}>Mint the moment.</h1>
            <p style={{ fontSize: 17, color: "var(--ink)", maxWidth: 560, lineHeight: 1.5, marginTop: 22 }}>
              Pick a timestamp in your video, cut that single frame, and put it on-chain. Collectors
              grab an edition for a few cents of USDC — and it pays you the instant they do.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
              <a href="#cut" className="btn btn--red">Cut a frame →</a>
              <a href="#sheet" className="btn">See the sheet</a>
            </div>

            {/* stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, marginTop: 38, border: "2px solid var(--ink)" }}>
              {[
                { k: "Frames cut", v: stats.frames.toString() },
                { k: "Editions collected", v: stats.collected.toString() },
                { k: "USDC paid out", v: "$" + fmtUsdc(stats.volume) },
              ].map((s, i) => (
                <div key={s.k} style={{ padding: "18px 20px", borderLeft: i ? "2px solid var(--ink)" : "none", background: i === 1 ? "var(--paper-2)" : "var(--paper)" }}>
                  <div className="display" style={{ fontSize: 38 }}>{s.v}</div>
                  <div className="tag" style={{ color: "var(--muted)", marginTop: 6 }}>{s.k}</div>
                </div>
              ))}
            </div>
          </section>

          {/* cut form */}
          <section id="cut" style={{ ...wrap, marginTop: 18 }}>
            <div className="box" style={{ background: "var(--paper)" }}>
              <div className="filmstrip" />
              <div style={{ padding: 20 }}>
                <div className="tag" style={{ marginBottom: 16, color: "var(--red)" }}>● REC — cut a new frame</div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label className="tag" style={{ color: "var(--muted)", display: "block", marginBottom: 6 }}>Video link</label>
                    <input value={video} onChange={(e) => setVideo(e.target.value)} maxLength={300} placeholder="https://youtube.com/…" className="input" disabled={!account} />
                  </div>
                  <div>
                    <label className="tag" style={{ color: "var(--muted)", display: "block", marginBottom: 6 }}>Timecode</label>
                    <input value={tc} onChange={(e) => setTc(e.target.value)} placeholder="1:23  or  83" className="input" disabled={!account} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) auto", gap: 12, alignItems: "end" }}>
                  <div>
                    <label className="tag" style={{ color: "var(--muted)", display: "block", marginBottom: 6 }}>Frame title</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="The look, act III" className="input" disabled={!account} />
                  </div>
                  <div>
                    <label className="tag" style={{ color: "var(--muted)", display: "block", marginBottom: 6 }}>Price / edition (USDC)</label>
                    <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.5" className="input" disabled={!account} />
                  </div>
                  {account ? (
                    <button onClick={cut} disabled={cutting} className="btn btn--red" style={{ height: 43 }}>{cutting ? "Cutting…" : "Cut frame"}</button>
                  ) : (
                    <button onClick={connect} className="btn btn--red" style={{ height: 43 }}>Connect</button>
                  )}
                </div>
                {cutMsg && (
                  <div className="mono" style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, color: cutMsg.startsWith("✓") ? "var(--ink)" : cutMsg.startsWith("✗") ? "var(--red)" : "var(--muted)" }}>{cutMsg}</div>
                )}
              </div>
            </div>
          </section>

          {/* contact sheet */}
          <section id="sheet" style={{ ...wrap, marginTop: 40 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <h2 className="display" style={{ fontSize: 40 }}>The contact sheet</h2>
              <div style={{ display: "flex", border: "2px solid var(--ink)" }}>
                {([["all", "All"], ["mine", "Yours"], ["collected", "Collected"]] as const).map(([t, lbl], i) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="tag"
                    style={{ padding: "9px 15px", border: "none", borderLeft: i ? "2px solid var(--ink)" : "none", background: tab === t ? "var(--ink)" : "var(--paper)", color: tab === t ? "var(--paper)" : "var(--ink)", cursor: "pointer" }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {!account && tab !== "all" ? (
              <div className="box" style={{ padding: 44, textAlign: "center" }} ><span className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>Connect your wallet to see this.</span></div>
            ) : list.length === 0 ? (
              <div className="box" style={{ padding: 44, textAlign: "center" }}><span className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>{tab === "all" ? "No frames cut yet. Be the first ↑" : tab === "mine" ? "You haven't cut a frame yet." : "Nothing collected yet."}</span></div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                {list.map((f) => (
                  <FrameCard key={f.id} frame={f} me={account} owned={owned[f.id] ?? 0} busy={collectBusy === f.id} msg={collectMsg[f.id]} onCollect={collectFrame} />
                ))}
              </div>
            )}
          </section>

          {/* why ARC */}
          <section style={{ ...wrap, marginTop: 56 }}>
            <div className="box" style={{ padding: 0 }}>
              <div style={{ padding: "26px 28px", borderBottom: "2px solid var(--ink)" }}>
                <div className="tag" style={{ color: "var(--red)", marginBottom: 12 }}>The Arc bit</div>
                <h2 className="display" style={{ fontSize: "clamp(28px,4vw,48px)", maxWidth: 720 }}>A 30-cent sale only works if it&apos;s actually instant and free to move.</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))" }}>
                {[
                  { n: "01", t: "Collecting is a USDC micro-payment", d: "Editions cost cents, priced in plain dollars. ARC settles in native USDC, so there's no token to buy and no approval to sign." },
                  { n: "02", t: "The creator gets paid on the spot", d: "The moment a fan collects, the USDC lands in your wallet in the same transaction. No platform float, no payout you chase." },
                  { n: "03", t: "Every cut is on the record", d: "Source video, exact timecode, price and every edition — all on-chain and readable by anyone on ArcScan." },
                ].map((row, i) => (
                  <div key={row.n} style={{ padding: "22px 24px", borderLeft: i ? "2px solid var(--ink)" : "none" }}>
                    <div className="display" style={{ fontSize: 22, color: "var(--red)", marginBottom: 10 }}>{row.n}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 7, lineHeight: 1.2 }}>{row.t}</div>
                    <div className="mono" style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{row.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* footer */}
          <footer style={{ ...wrap, marginTop: 40 }}>
            <div className="mono" style={{ borderTop: "2px solid var(--ink)", paddingTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <span style={{ color: "var(--muted)" }}>FrameCut · ARC Testnet</span>
              <a href={`${ARCSCAN}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 700 }}>
                Verified contract {shortAddr(CONTRACT_ADDRESS, 8, 6)} ↗
              </a>
            </div>
          </footer>
      </>
    </div>
  );
}
