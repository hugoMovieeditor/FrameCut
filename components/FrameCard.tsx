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

  return (
    <div className="box" style={{ display: "flex", flexDirection: "column" }}>
      {/* frame */}
      <a
        href={v.href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "relative",
          display: "block",
          aspectRatio: "16 / 9",
          background: v.thumb ? `var(--ink) center/cover no-repeat url(${v.thumb})` : "var(--paper-2)",
          borderBottom: "2px solid var(--ink)",
          textDecoration: "none",
        }}
      >
        {!v.thumb && (
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 28 }}>▶</span>
        )}
        {/* crop marks */}
        <span style={{ position: "absolute", top: 6, left: 6, width: 12, height: 12, borderTop: "2px solid var(--red)", borderLeft: "2px solid var(--red)" }} />
        <span style={{ position: "absolute", bottom: 6, right: 6, width: 12, height: 12, borderBottom: "2px solid var(--red)", borderRight: "2px solid var(--red)" }} />
        {/* timecode bar */}
        <div className="mono" style={{ position: "absolute", left: 0, bottom: 0, display: "flex", gap: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em" }}>
          <span style={{ background: "var(--ink)", color: "var(--paper)", padding: "3px 7px" }}>FR-{String(frame.id).padStart(3, "0")}</span>
          <span style={{ background: "var(--red)", color: "var(--paper)", padding: "3px 7px" }}>TC {fmtTimecode(frame.atMs)}</span>
        </div>
      </a>

      {/* meta */}
      <div style={{ padding: "11px 12px", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.15, marginBottom: 4 }}>{frame.title}</div>
          <a href={`${ARCSCAN}/address/${frame.creator}`} target="_blank" rel="noopener noreferrer" className="mono" style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none" }}>
            {mine ? "by you" : `by ${shortAddr(frame.creator)}`}
          </a>
        </div>

        <div className="mono" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700, borderTop: "2px solid var(--ink)", paddingTop: 9 }}>
          <span>{free ? "FREE" : "$" + fmtUsdc(frame.price)}</span>
          <span style={{ color: "var(--muted)" }}>
            {owned > 0 && <span style={{ color: "var(--red)" }}>you own {owned} · </span>}
            {frame.editions} collected
          </span>
        </div>

        {mine ? (
          <div className="tag box-fill" style={{ textAlign: "center", padding: "8px 0", color: "var(--muted)" }}>Your cut</div>
        ) : (
          <button onClick={() => onCollect(frame.id, frame.price)} disabled={busy} className="btn btn--red btn--sm" style={{ width: "100%" }}>
            {busy ? "…" : owned > 0 ? (free ? "Collect another" : `Collect another · $${fmtUsdc(frame.price)}`) : free ? "Collect · free" : `Collect · $${fmtUsdc(frame.price)}`}
          </button>
        )}
        {msg && (
          <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: msg.startsWith("✓") ? "var(--ink)" : msg.startsWith("✗") ? "var(--red)" : "var(--muted)" }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
