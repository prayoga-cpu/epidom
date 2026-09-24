/** Small gold outline tag naming the plan a feature needs ("Free", "POS plan", …). */
export function PlanPill({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid rgba(217,174,59,0.36)",
        background: "rgba(217,174,59,0.10)",
        color: "var(--epi-gold-300)",
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 600,
        lineHeight: 1.3,
      }}
    >
      {label}
    </span>
  );
}

/** The gold check used in front of every feature bullet on the Services page. */
export function CheckMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7" fill="rgba(217,174,59,0.16)" />
      <path d="M5 8l2 2 4-4" stroke="var(--epi-gold-400)" strokeWidth="1.6" fill="none" />
    </svg>
  );
}
