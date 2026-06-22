"use client";

import { Frame, parseVideo, fmtUsdc, fmtTimecode, shortAddr } from "@/lib/framecut";
import { ARCSCAN } from "@/lib/arcNetwork";

interface Props {
  frame: Frame;
  me: string;
  owned?: number;
  busy: boolean;
  msg?: string;
  onCollect: (id: number, price: bigint) => void;
}

export default function FrameCard({ frame, me, owned = 0, busy, msg, onCollect }: Props) {
  const v = parseVideo(frame.video, frame.atMs);
  const mine = me && frame.creator.toLowerCase() === me.toLowerCase();
  const free = frame.price === 0n;
  const srcLabel = `SRC_${String(frame.id).padStart(3, "0")}`;

  return (
    <div className="src-card">
      {/* connector nubs on the card edges (decorative node anchors) */}
      <span className="nub left" />
      <span className="nub right" />

      {/* source label row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 13px 9px" }}>
        <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "var(--glow)" }}>{srcLabel}</span>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>TC {fmtTimecode(frame.atMs)}</span>
      </div>

      {/* frame preview — the "source" media on the canvas */}
      <a
        href={v.href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "relative",
          display: "block",
          margin: "0 13px",
          aspectRatio: "16 / 9",
          background: "var(--bg-2)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          textDecoration: "none",
          overflow: "hidden",
        }}
      >
        {/* play glyph sits underneath; a real <img> covers it and hides itself if the thumb 404s */}
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="play-chip">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </span>
        {v.thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={v.thumb}
            alt=""
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {/* corner crop marks */}
        <span style={{ position: "absolute", top: 7, left: 7, width: 11, height: 11, borderTop: "1.5px solid var(--glow)", borderLeft: "1.5px solid var(--glow)" }} />
        <span style={{ position: "absolute", bottom: 7, right: 7, width: 11, height: 11, borderBottom: "1.5px solid var(--glow)", borderRight: "1.5px solid var(--glow)" }} />
      </a>

      {/* meta */}
      <div style={{ padding: "12px 13px 13px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.2, marginBottom: 4, letterSpacing: "-0.01em" }}>{frame.title}</div>
          <a href={`${ARCSCAN}/address/${frame.creator}`} target="_blank" rel="noopener noreferrer" className="mono" style={{ fontSize: 10.5, color: "var(--muted)", textDecoration: "none" }}>
            {mine ? "by you" : `by ${shortAddr(frame.creator)}`}
          </a>
        </div>

        <div className="mono" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, borderTop: "1px solid var(--line-2)", paddingTop: 10 }}>
          <span style={{ color: "var(--ink)", fontWeight: 500 }}>{free ? "FREE" : "$" + fmtUsdc(frame.price)}</span>
          <span style={{ color: "var(--muted)" }}>
            {owned > 0 && <span style={{ color: "var(--glow)" }}>you own {owned} · </span>}
            {frame.editions} collected
          </span>
        </div>

        {mine ? (
          <div className="chip" style={{ justifyContent: "center", padding: "9px 0", color: "var(--muted)" }}>Your cut</div>
        ) : (
          <button onClick={() => onCollect(frame.id, frame.price)} disabled={busy} className="btn btn--primary btn--sm" style={{ width: "100%" }}>
            {busy ? "…" : owned > 0 ? (free ? "Collect another" : `Collect another · $${fmtUsdc(frame.price)}`) : free ? "Collect · free" : `Collect · $${fmtUsdc(frame.price)}`}
          </button>
        )}
        {msg && (
          <div className="mono" style={{ fontSize: 10.5, color: msg.startsWith("✓") ? "var(--ok)" : msg.startsWith("✗") ? "var(--bad)" : "var(--muted)" }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
