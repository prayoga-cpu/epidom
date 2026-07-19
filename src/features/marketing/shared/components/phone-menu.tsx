"use client";

export function PhoneMenu() {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 300,
        aspectRatio: "280 / 580",
        borderRadius: 44,
        background: "#0a0a0a",
        padding: 10,
        boxShadow: "0 40px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)",
        position: "relative",
      }}
    >
      {/* Notch */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          width: 80,
          height: 24,
          borderRadius: 99,
          background: "#000",
          zIndex: 5,
        }}
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 36,
          overflow: "hidden",
          background: "var(--epi-cream-50)",
          position: "relative",
          color: "#1a1a1a",
          fontFamily: "var(--epi-font-body)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Status bar */}
        <div
          style={{
            padding: "14px 20px 8px",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            fontWeight: 600,
            color: "#1a1a1a",
          }}
        >
          <span>9:41</span>
          <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <svg width="14" height="9" viewBox="0 0 14 9" aria-hidden="true">
              <path
                d="M0 7h2v2H0zm3-1.5h2V9H3zm3-1.5h2v5H6zm3-1.5h2v6.5H9zm3-1.5h2v8h-2z"
                fill="#1a1a1a"
              />
            </svg>
            <span style={{ fontSize: 9 }}>••••</span>
          </span>
        </div>

        {/* Banner */}
        <div
          style={{
            margin: "8px 14px 0",
            borderRadius: 16,
            height: 110,
            background: "linear-gradient(135deg, var(--epi-navy-700), var(--epi-navy-900))",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "flex-end",
            padding: 14,
            color: "var(--epi-cream-50)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(0deg, rgba(6,15,27,0.95) 0%, rgba(6,15,27,0.5) 60%, rgba(6,15,27,0.3) 100%)",
            }}
          />
          <div style={{ position: "relative", zIndex: 2 }}>
            <div
              style={{
                fontFamily: "var(--epi-font-display)",
                fontSize: 18,
                letterSpacing: "0.08em",
                lineHeight: 1,
              }}
            >
              WARUNG SARI
            </div>
            <div
              style={{ fontSize: 10, color: "var(--epi-cream-100)", marginTop: 4, opacity: 0.9 }}
            >
              Specialty coffee · Bandung
            </div>
          </div>
        </div>

        {/* Category tabs */}
        <div style={{ display: "flex", gap: 6, padding: "14px 14px 4px", overflow: "hidden" }}>
          {["Coffee", "Tea", "Pastry", "Snacks"].map((c, i) => (
            <div
              key={i}
              style={{
                padding: "5px 11px",
                borderRadius: 99,
                fontSize: 10,
                fontWeight: 500,
                background: i === 0 ? "var(--epi-navy-900)" : "#f0eddc",
                color: i === 0 ? "var(--epi-cream-50)" : "#5a5a5a",
              }}
            >
              {c}
            </div>
          ))}
        </div>

        {/* Menu items */}
        <div
          style={{
            padding: "8px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flex: 1,
            overflow: "hidden",
          }}
        >
          {[
            { n: "Vanilla Latte", d: "Single origin · oat option", p: "Rp 38k", c: "#7a4f2f" },
            { n: "Iced Matcha", d: "Ceremonial grade", p: "Rp 42k", c: "#79925a" },
            { n: "Croffle Original", d: "House butter · maple", p: "Rp 28k", c: "#c69a5e" },
            { n: "Choco Cookie", d: "Dark chocolate 70%", p: "Rp 18k", c: "#5a3a2a" },
          ].map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  flexShrink: 0,
                  background: `linear-gradient(135deg, ${m.c}, #2a1f12)`,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a" }}>{m.n}</div>
                <div style={{ fontSize: 10, color: "#777" }}>{m.d}</div>
              </div>
              <div style={{ fontSize: 11, color: "#1a1a1a", fontWeight: 600 }}>{m.p}</div>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--epi-navy-900)",
                  color: "var(--epi-cream-50)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  lineHeight: 1,
                  paddingBottom: 1,
                }}
              >
                +
              </div>
            </div>
          ))}
        </div>

        {/* Cart bar */}
        <div
          style={{
            margin: "8px 14px 16px",
            padding: "10px 14px",
            borderRadius: 14,
            background: "var(--epi-navy-900)",
            color: "var(--epi-cream-50)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0, flex: "0 1 auto" }}>
            <div
              style={{
                fontSize: 9,
                opacity: 0.5,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
              }}
            >
              2 items
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>Rp 66k</div>
          </div>
          <div
            style={{
              padding: "7px 12px",
              borderRadius: 99,
              background: "var(--epi-gold-500)",
              color: "var(--epi-navy-900)",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            Pay QRIS →
          </div>
        </div>

        {/* Home indicator */}
        <div
          style={{
            position: "absolute",
            bottom: 6,
            left: "50%",
            transform: "translateX(-50%)",
            width: 100,
            height: 4,
            borderRadius: 2,
            background: "#1a1a1a",
          }}
        />
      </div>
    </div>
  );
}
