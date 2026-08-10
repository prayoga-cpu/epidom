"use client";

import { useI18n, type Locale } from "@/components/lang/i18n-provider";
import { Sparkline } from "./sparkline";

interface OrderRow {
  id: string;
  who: string;
  items: string;
  val: string;
  s: "paid" | "kitchen";
}

const CONTENT: Record<
  Locale,
  {
    ownerName: string;
    shopName: string;
    dateLabel: string;
    navItems: string[];
    planLabel: string;
    todayLive: string;
    greeting: string;
    posOpen: string;
    newOrders: string;
    revenueLabel: string;
    revenueSource: string;
    revenueVal: string;
    revenueDelta: string;
    thisWeek: string;
    lastWeek: string;
    kpis: Array<{ l: string; v: string; d: string }>;
    recentOrders: string;
    ordersMenu: string;
    orders: OrderRow[];
    statusLabel: Record<"paid" | "kitchen", string>;
  }
> = {
  fr: {
    ownerName: "Camille",
    shopName: "Café Bretonne",
    dateLabel: "Lun · 22 mai",
    navItems: ["Tableau de bord", "Commandes", "Menu", "Caisse", "Cuisine", "Stock", "Équipe", "Rapports"],
    planLabel: "Forfait · Opérations",
    todayLive: "Aujourd'hui · en direct",
    greeting: "Bonjour, Camille.",
    posOpen: "Caisse ouverte",
    newOrders: "3 nouvelles commandes",
    revenueLabel: "Revenu · cette semaine",
    revenueSource: "via IG et lien menu",
    revenueVal: "2 850 €",
    revenueDelta: "▲ 12,4%",
    thisWeek: "Cette semaine",
    lastWeek: "Semaine dernière",
    kpis: [
      { l: "Commandes aujourd'hui", v: "47", d: "+9 vs hier" },
      { l: "Panier moyen", v: "6,20 €", d: "+8%" },
      { l: "Coût matière", v: "32%", d: "objectif atteint" },
    ],
    recentOrders: "Commandes récentes",
    ordersMenu: "commandes et menu",
    orders: [
      { id: "#1042", who: "Hugo · Sur place", items: "Latte · Croffle", val: "4,80 €", s: "paid" },
      { id: "#1041", who: "Manon · Lien IG", items: "Matcha · Cookie", val: "5,60 €", s: "kitchen" },
      { id: "#1040", who: "Théo · QR table 4", items: "Espresso × 2", val: "3,80 €", s: "paid" },
    ],
    statusLabel: { paid: "payé", kitchen: "cuisine" },
  },
  id: {
    ownerName: "Sari",
    shopName: "Warung Sari",
    dateLabel: "Sen · 22 Mei",
    navItems: ["Dashboard", "Pesanan", "Menu", "Kasir", "Dapur", "Stok", "Staf", "Laporan"],
    planLabel: "Paket · Operations",
    todayLive: "Hari ini · langsung",
    greeting: "Selamat pagi, Sari.",
    posOpen: "Kasir buka",
    newOrders: "3 pesanan baru",
    revenueLabel: "Pendapatan · minggu ini",
    revenueSource: "via IG & link menu",
    revenueVal: "Rp 24.8M",
    revenueDelta: "▲ 12.4%",
    thisWeek: "Minggu ini",
    lastWeek: "Minggu lalu",
    kpis: [
      { l: "Pesanan hari ini", v: "47", d: "+9 dari kemarin" },
      { l: "Rata-rata pesanan", v: "Rp 62k", d: "+8%" },
      { l: "COGS hari ini", v: "32%", d: "sesuai target" },
    ],
    recentOrders: "Pesanan terbaru",
    ordersMenu: "pesanan & menu",
    orders: [
      { id: "#1042", who: "Andi · Walk-in", items: "Latte · Croffle", val: "Rp 48k", s: "paid" },
      { id: "#1041", who: "Maya · IG link", items: "Matcha · Cookie", val: "Rp 56k", s: "kitchen" },
      { id: "#1040", who: "Riko · QR table 4", items: "Espresso × 2", val: "Rp 38k", s: "paid" },
    ],
    statusLabel: { paid: "paid", kitchen: "kitchen" },
  },
  en: {
    ownerName: "Alex",
    shopName: "The Grind House",
    dateLabel: "Mon · May 22",
    navItems: ["Dashboard", "Orders", "Menu", "POS", "Kitchen", "Stock", "Staff", "Reports"],
    planLabel: "Plan · Operations",
    todayLive: "Today · live",
    greeting: "Good morning, Alex.",
    posOpen: "POS open",
    newOrders: "3 new orders",
    revenueLabel: "Revenue · this week",
    revenueSource: "via IG & menu link",
    revenueVal: "$3,150",
    revenueDelta: "▲ 12.4%",
    thisWeek: "This week",
    lastWeek: "Last week",
    kpis: [
      { l: "Orders today", v: "47", d: "+9 from yesterday" },
      { l: "Avg ticket", v: "$6.20", d: "+8%" },
      { l: "COGS today", v: "32%", d: "within target" },
    ],
    recentOrders: "Recent orders",
    ordersMenu: "orders & menu",
    orders: [
      { id: "#1042", who: "Jordan · Walk-in", items: "Latte · Croffle", val: "$4.80", s: "paid" },
      { id: "#1041", who: "Sam · IG link", items: "Matcha · Cookie", val: "$5.60", s: "kitchen" },
      { id: "#1040", who: "Riley · QR table 4", items: "Espresso × 2", val: "$3.80", s: "paid" },
    ],
    statusLabel: { paid: "paid", kitchen: "kitchen" },
  },
};

export function PosDashboard() {
  const { locale } = useI18n();
  const c = CONTENT[locale];

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
            {["#FF5F57", "#FEBC2E", "#28C840"].map((clr) => (
              <div
                key={clr}
                style={{ width: 8, height: 8, borderRadius: "50%", background: clr, opacity: 0.7 }}
              />
            ))}
          </div>
          <span
            style={{ fontFamily: "var(--epi-font-display)", fontSize: 13, letterSpacing: "0.12em" }}
          >
            EPIDOM
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
            {c.shopName}
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
            {c.dateLabel}
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
            {c.ownerName.charAt(0)}
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
          {c.navItems.map((label, i) => (
            <div
              key={i}
              style={{
                padding: "6px 10px",
                borderRadius: 7,
                fontSize: 11,
                color: "var(--epi-cream-50)",
                opacity: i === 0 ? 1 : 0.45,
                background: i === 0 ? "rgba(217,174,59,0.10)" : "transparent",
                borderLeft: i === 0 ? "2px solid var(--epi-gold-500)" : "2px solid transparent",
                display: "flex",
                alignItems: "center",
                gap: 8,
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  color: i === 0 ? "var(--epi-gold-400)" : "var(--epi-cream-50)",
                  opacity: i === 0 ? 1 : 0.4,
                  fontSize: 9,
                }}
              >
                {i === 0 ? "◆" : "◇"}
              </span>
              {label}
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
            {c.planLabel}
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
                {c.todayLive}
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
                {c.greeting}
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
                {c.posOpen}
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
                {c.newOrders}
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
                    {c.revenueLabel}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--epi-cream-50)",
                      opacity: 0.38,
                      marginTop: 1,
                    }}
                  >
                    {c.revenueSource}
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
                    {c.revenueVal}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--epi-gold-400)" }}>{c.revenueDelta}</div>
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
                  <span style={{ color: "var(--epi-gold-400)", opacity: 1 }}>●</span> {c.thisWeek}
                </span>
                <span>
                  <span style={{ color: "var(--epi-navy-400)", opacity: 1 }}>●</span> {c.lastWeek}
                </span>
              </div>
            </div>

            {/* KPI cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {c.kpis.map((k, i) => (
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
                  <div
                    style={{
                      fontSize: 9,
                      color: i < 2 ? "var(--epi-gold-400)" : "var(--epi-navy-400)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {k.d}
                  </div>
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
              <span>{c.recentOrders}</span>
              <span>{c.ordersMenu}</span>
            </div>
            {c.orders.map((o, i) => (
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
                  {c.statusLabel[o.s]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
