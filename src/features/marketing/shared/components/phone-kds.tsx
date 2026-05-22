"use client";

export function PhoneKDS() {
  return (
    <div style={{
      width: "100%", maxWidth: 300,
      aspectRatio: "280 / 580",
      borderRadius: 44,
      background: "#0a0a0a",
      padding: 10,
      boxShadow: "0 40px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
      position: "relative",
    }}>
      {/* Notch */}
      <div style={{
        position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
        width: 80, height: 24, borderRadius: 99, background: "#000", zIndex: 5,
      }} />
      <div style={{
        width: "100%", height: "100%",
        borderRadius: 36, overflow: "hidden",
        background: "var(--epi-navy-900)",
        position: "relative",
        color: "var(--epi-cream-50)",
        fontFamily: "var(--epi-font-body)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Status bar */}
        <div style={{
          padding: "14px 20px 8px",
          display: "flex", justifyContent: "space-between",
          fontSize: 11, fontWeight: 600,
        }}>
          <span>9:41</span>
          <span style={{ color: "var(--epi-gold-400)" }}>● live</span>
        </div>

        <div style={{ padding: "8px 16px" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.4 }}>
            Kitchen · 3 active
          </div>
          <div style={{ fontFamily: "var(--epi-font-display)", fontSize: 22, letterSpacing: "0.06em", marginTop: 2 }}>
            Tickets
          </div>
        </div>

        <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
          {[
            { id: "#1042", t: "02:14", items: ["1 × Latte", "1 × Croffle"],    from: "Table 4",       urgent: false },
            { id: "#1041", t: "04:50", items: ["1 × Matcha", "1 × Cookie"],    from: "IG link · Maya",urgent: true  },
            { id: "#1040", t: "06:32", items: ["2 × Espresso"],                from: "Walk-in",       urgent: false },
          ].map((ticket, i) => (
            <div key={i} style={{
              padding: 12, borderRadius: 12,
              background: ticket.urgent ? "rgba(217,174,59,0.16)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${ticket.urgent ? "rgba(217,174,59,0.4)" : "rgba(255,255,255,0.08)"}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: ticket.urgent ? "var(--epi-gold-300)" : "var(--epi-cream-50)" }}>
                  {ticket.id}
                </span>
                <span style={{ fontSize: 11, color: ticket.urgent ? "var(--epi-gold-300)" : "var(--epi-cream-50)", opacity: ticket.urgent ? 1 : 0.5, fontVariantNumeric: "tabular-nums" }}>
                  {ticket.t}
                </span>
              </div>
              {ticket.items.map((it, j) => (
                <div key={j} style={{ fontSize: 11, color: "var(--epi-cream-50)", marginBottom: 2 }}>• {it}</div>
              ))}
              <div style={{ fontSize: 10, opacity: 0.4, marginTop: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {ticket.from}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          margin: "0 14px 16px", padding: "12px 14px", borderRadius: 14,
          background: "var(--epi-gold-500)", color: "var(--epi-navy-900)",
          fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
          textAlign: "center",
        }}>
          Mark next ticket ready →
        </div>

        {/* Home indicator */}
        <div style={{
          position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)",
          width: 100, height: 4, borderRadius: 2,
          background: "var(--epi-cream-50)", opacity: 0.6,
        }} />
      </div>
    </div>
  );
}
