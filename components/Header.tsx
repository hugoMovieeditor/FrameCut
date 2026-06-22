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
    <header style={{ position: "sticky", top: 0, zIndex: 50, padding: "16px 18px 0" }}>
      {/* pill-shaped floating nav */}
      <div
        className="glass"
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "9px 10px 9px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          borderRadius: 999,
          boxShadow: "0 18px 40px -26px rgba(0,0,0,0.9)",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
          <Logo size={24} />
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>
            Frame<span style={{ color: "var(--ink-2)", fontWeight: 400 }}>Cut</span>
          </span>
        </Link>

        {/* center nav hint — the "canvas" framing */}
        <nav style={{ display: "flex", alignItems: "center", gap: 22 }} className="hdr-balance">
          <a href="#canvas" className="mono" style={{ fontSize: 11.5, color: "var(--muted)", textDecoration: "none", letterSpacing: "0.06em" }}>Canvas</a>
          <a href="#cut" className="mono" style={{ fontSize: 11.5, color: "var(--muted)", textDecoration: "none", letterSpacing: "0.06em" }}>Cut</a>
          <a href="#arc" className="mono" style={{ fontSize: 11.5, color: "var(--muted)", textDecoration: "none", letterSpacing: "0.06em" }}>Network</a>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0, minWidth: 0 }}>
          {account ? (
            <>
              {!chainOk && (
                <button
                  type="button"
                  onClick={() => switchToArc().catch(() => {})}
                  className="btn btn--sm"
                  style={{ borderColor: "var(--bad)", color: "var(--bad)" }}
                >
                  Wrong net — switch
                </button>
              )}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setOpen((o) => !o)}
                  className="btn btn--sm"
                  style={{ gap: 9, color: "var(--ink)" }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: chainOk ? "var(--ok)" : "var(--bad)", boxShadow: chainOk ? "0 0 7px var(--ok)" : "none", flexShrink: 0 }} />
                  <span className="hdr-balance">{balance || "0"} USDC</span>
                  <span className="hdr-div" style={{ width: 1, height: 12, background: "var(--line)" }} />
                  <span>{account.slice(0, 5)}…{account.slice(-3)}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {open && (
                  <>
                    <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
                    <div className="panel" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 61, minWidth: 232, overflow: "hidden" }}>
                      <div style={{ padding: "12px 14px" }}>
                        <div className="tag" style={{ marginBottom: 5 }}>Connected</div>
                        <div className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>{account.slice(0, 12)}…{account.slice(-8)}</div>
                      </div>
                      <button className="menu-item" onClick={copy}>{copied ? "Copied!" : "Copy address"}</button>
                      <a className="menu-item" href={`${ARCSCAN}/address/${account}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>View on ArcScan ↗</a>
                      <button className="menu-item danger" onClick={() => { setOpen(false); onDisconnect(); }}>Disconnect</button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={onConnect}
              disabled={connecting}
              className="btn btn--primary"
            >
              {connecting ? "Linking…" : "Link wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
