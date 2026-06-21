export default function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="#14130e" strokeWidth="9" strokeLinecap="square">
        <path d="M10 32 V10 H32" />
        <path d="M68 10 H90 V32" />
        <path d="M90 68 V90 H68" />
        <path d="M32 90 H10 V68" />
      </g>
      <rect x="38" y="38" width="24" height="24" fill="#e0301c" />
    </svg>
  );
}
