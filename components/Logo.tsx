export default function Logo({ size = 26 }: { size?: number }) {
  // Bespoke node-canvas mark: a "frame" node linked by a dashed connector to a
  // smaller cut node, with a centred play notch — FrameCut on a content canvas.
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* dashed connector */}
      <path d="M34 50 H72" stroke="var(--glow, #8ea0ff)" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 9" />
      {/* frame node */}
      <rect x="8" y="26" width="48" height="48" rx="13" stroke="var(--ink, #f4f5f6)" strokeWidth="5" />
      {/* play notch inside the frame */}
      <path d="M27 38 L41 50 L27 62 Z" fill="var(--ink, #f4f5f6)" />
      {/* cut node */}
      <circle cx="80" cy="50" r="12" stroke="var(--glow, #8ea0ff)" strokeWidth="5" fill="none" />
      <circle cx="80" cy="50" r="3.4" fill="var(--glow, #8ea0ff)" />
    </svg>
  );
}
