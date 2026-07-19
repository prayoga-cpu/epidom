"use client";

import { Sparkline } from "./sparkline";

export function PosDashboard() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "720 / 460",
        borderRadius: 22,
        background: "linear-gradient(160deg, #0E1F38 0%, #060F1B 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 40px 80px -30px rgba(0,0,0,0.7), 0 0 0 1px rgba(91,136,178,0.10)",
        overflow: "hidden",
        color: "var(--epi-cream-50)",
        fontFamily: "var(--epi-font-body)",
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.20)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <div
                key={c}
                style={{ width: 8, height: 8, borderRadius: "50%", background: c, opacity: 0.7 }}
              />
            ))}
          </div>
          <span
            style={{ fontFamily: "var(--epi-font-display)", fontSize: 13, letterSpacing: "0.12em" }}
          >
            ÉPIDOM
          </span>
          <span
            style={{
              fontSize: 9,
              color: "var(--epi-cream-50)",
              opacity: 0.5,
              padding: "2px 7px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Warung Sari
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 9,
              color: "var(--epi-cream-50)",
              opacity: 0.38,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Mon · May 22
          </span>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--epi-gold-500), var(--epi-gold-700))",
              display: "grid",
              placeItems: "center",
              fontSize: 9,
              color: "var(--epi-navy-900)",
              fontWeight: 700,
            }}
          >
            S
          </div>
        </div>
      </div>

      {/* Body */}
      <div
        style={{ display: "grid", gridTemplateColumns: "120px 1fr", height: "calc(100% - 44px)" }}
      >
        {/* Sidebar */}
        <aside
          style={{
            borderRight: "1px solid rgba(255,255,255,0.05)",
            padding: "12px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {(
            [
              ["◆", "Dashboard", true],
              ["◇", "Orders", false],
              ["◇", "Menu", false],
              ["◇", "POS", false],
              ["◇", "Kitchen", false],
              ["◇", "Stock", false],
              ["◇", "Staff", false],
              ["◇", "Reports", false],
            ] as [string, string, boolean][]
          ).map((it, i) => (
            <div
              key={i}
              style={{
                padding: "6px 10px",
                borderRadius: 7,
                fontSize: 11,
                color: "var(--epi-cream-50)",
                opacity: it[2] ? 1 : 0.45,
                background: it[2] ? "rgba(217,174,59,0.10)" : "transparent",
                borderLeft: it[2] ? "2px solid var(--epi-gold-500)" : "2px solid transparent",
                display: "flex",
                alignItems: "center",
                gap: 8,
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  color: it[2] ? "var(--epi-gold-400)" : "var(--epi-cream-50)",
                  opacity: it[2] ? 1 : 0.4,
                  fontSize: 9,
                }}
              >
                {it[0]}
              </span>
              {it[1]}
            </div>
          ))}
          <div
            style={{
              marginTop: "auto",
              paddingTop: 10,
              borderTop: "1px solid rgba(255,255,255,0.05)",
              fontSize: 9,
              color: "var(--epi-cream-50)",
              opacity: 0.35,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Plan · Operations
          </div>
        </aside>

        {/* Main content */}
        <div
          style={{
            padding: "14px 16px",
            display: "grid",
            gridTemplateRows: "auto 1fr auto",
            gap: 12,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div
                style={{
                  fontSize: 9,
                  color: "var(--epi-cream-50)",
                  opacity: 0.38,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                Today · live
              </div>
              <div
                style={{
                  fontFamily: "var(--epi-font-display)",
                  fontSize: 18,
                  letterSpacing: "0.03em",
                  color: "var(--epi-cream-50)",
                  marginTop: 2,
                }}
              >
                Good morning, Sari.
              </div>
            </div>
            <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
              <span
                style={{
                  padding: "3px 7px",
                  borderRadius: 7,
                  background: "rgba(91,136,178,0.16)",
                  border: "1px solid rgba(91,136,178,0.35)",
                  fontSize: 8,
                  color: "var(--epi-navy-400)",
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                POS open
              </span>
              <span
                style={{
                  padding: "3px 7px",
                  borderRadius: 7,
                  background: "rgba(217,174,59,0.12)",
                  border: "1px solid rgba(217,174,59,0.32)",
                  fontSize: 8,
                  color: "var(--epi-gold-300)",
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                3 new orders
              </span>
            </div>
          </div>

          {/* Chart + KPIs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr",
              gap: 10,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {/* Revenue chart */}
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: "var(--epi-cream-50)", fontWeight: 500 }}>
                    Revenue · this week
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--epi-cream-50)",
                      opacity: 0.38,
                      marginTop: 1,
                    }}
                  >
                    via IG &amp; menu link
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--epi-font-display)",
                      fontSize: 18,
                      letterSpacing: "0.02em",
                      color: "var(--epi-cream-50)",
                    }}
                  >
                    Rp 24.8M
                  </div>
                  <div style={{ fontSize: 9, color: "var(--epi-gold-400)" }}>▲ 12.4%</div>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
                  <Sparkline
                    points={[14, 17, 16, 22, 20, 26, 24]}
                    color="#5B88B2"
                    height={100}
                    fill={false}
                    strokeWidth={1.2}
                  />
                </div>
                <div style={{ position: "absolute", inset: 0 }}>
                  <Sparkline points={[18, 22, 20, 26, 28, 32, 36]} color="#D9AE3B" height={100} />
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  fontSize: 9,
                  color: "var(--epi-cream-50)",
                  opacity: 0.45,
                }}
              >
                <span>
                  <span style={{ color: "var(--epi-gold-400)", opacity: 1 }}>●</span> This week
                </span>
                <span>
                  <span style={{ color: "var(--epi-navy-400)", opacity: 1 }}>●</span> Last week
                </span>
              </div>
            </div>

            {/* KPI cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { l: "Orders today", v: "47", d: "+9 from yesterday", col: "var(--epi-gold-400)" },
                { l: "Avg ticket", v: "Rp 62k", d: "+8%", col: "var(--epi-gold-400)" },
                { l: "COGS today", v: "32%", d: "within target", col: "var(--epi-navy-400)" },
              ].map((k, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: 1,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      fontSize: 8,
                      color: "var(--epi-cream-50)",
                      opacity: 0.38,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {k.l}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--epi-font-display)",
                      fontSize: 20,
                      letterSpacing: "0.02em",
                      color: "var(--epi-cream-50)",
                      lineHeight: 1.1,
                    }}
                  >
                    {k.v}
                  </div>
                  <div style={{ fontSize: 9, color: k.col, whiteSpace: "nowrap" }}>{k.d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent orders */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "7px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                fontSize: 8,
                color: "var(--epi-cream-50)",
                opacity: 0.38,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>Recent orders</span>
              <span>orders &amp; menu</span>
            </div>
            {[
              {
                id: "#1042",
                who: "Andi · Walk-in",
                items: "Latte · Croffle",
                val: "Rp 48k",
                s: "paid",
              },
              {
                id: "#1041",
                who: "Maya · IG link",
                items: "Matcha · Cookie",
                val: "Rp 56k",
                s: "kitchen",
              },
              {
                id: "#1040",
                who: "Riko · QR table 4",
                items: "Espresso × 2",
                val: "Rp 38k",
                s: "paid",
              },
            ].map((o, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr 1fr 56px 52px",
                  gap: 8,
                  alignItems: "center",
                  padding: "8px 12px",
                  borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  fontSize: 10,
                }}
              >
                <span
                  style={{
                    color: "var(--epi-gold-400)",
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 9,
                  }}
                >
                  {o.id}
                </span>
                <span
                  style={{
                    color: "var(--epi-cream-50)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {o.who}
                </span>
                <span
                  style={{
                    color: "var(--epi-cream-50)",
                    opacity: 0.5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {o.items}
                </span>
                <span
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    textAlign: "right",
                    color: "var(--epi-cream-50)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {o.val}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    fontSize: 8,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: o.s === "paid" ? "var(--epi-gold-400)" : "var(--epi-navy-400)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {o.s}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
