# SmartOps Upgrade Plan & Roadmap

## 🎯 Alignment with Vision
This plan transforms the current `epidom` prototype into **SmartOps**, directly mapping your core requirements to executable phases.

| User Request ("Esensi Aplikasi") | Implementation Phase | Action |
| :--- | :--- | :--- |
| **Actionable Dashboard** | **Phase 0 & 4** | Fix UI/UX Foundation & Build Insight Widgets |
| **AI Sheet Parser** | **Phase 1** | Implement Client-Side Parsing + "AI Validation Station" |
| **Smart Inventory** | **Phase 1 & 2** | Activate Stock linkage, Low-stock alerts, & Reorder Drafts |
| **Real-time POS** | **Phase 2** | **BUILD FROM SCRATCH**: Offline-capable Cashier Module |
| **Finance & Cashflow** | **Phase 3** | Implement COGS vs OPEX logic & P&L Reporting |

---

## 📅 The Execution Roadmap

### Phase 0: Foundation & "Premium" UI (Week 1)
*Goal: Create the "SmartOps" look & feel. Address the "Theme Inconsistency" issue immediately so the app feels professional.*

1.  **Global Theme & Branding:**
    - [ ] **Audit CSS:** Fix `globals.css` variable conflicts to solve dark/light mode issues.
    - [ ] **Typography & Color:** Enforce the "Premium" aesthetic (Inter/Outfit fonts, clean borders).
2.  **Navigation Restructure:**
    - [ ] Update Sidebar to reflect the Superapp modules: `Dashboard`, `POS`, `Inventory`, `Finance`, `AI Inbox`.
3.  **Database Health Check:**
    - [ ] Verify existing `Store` and `Product` tables are ready for data.

### Phase 1: The "Input" Engine (AI Parser & Inventory) (Week 2)
*Goal: Feed the system with data. Without this, POS has nothing to sell.*

1.  **Smart Sheet Ingest (The Killer Feature):**
    - [ ] **Client-Side Parsing:** Build logic to read Excel in browser (prevents server timeout).
    - [ ] **AI "Validation Station":** UI for users to map columns (e.g., "Harga" -> `costPrice`) via AI suggestions.
    - [ ] **Memory System:** Ensure `AIImportMemory` table saves these mappings for future speed.
2.  **Smart Inventory Management:**
    - [ ] **Stock Dashboard:** View real-time stock levels.
    - [ ] **Adjustment History:** Mandatory "Reason" input when changing stock manually (Security).

### Phase 2: The "Process" Engine (Real-time POS) (Week 3)
*Goal: The revenue generator. This module is currently missing and will be built new.*

1.  **Build POS Module (`src/features/pos`):**
    - [ ] **Layout:** Full-screen, distraction-free "Cashier Mode".
    - [ ] **Product Grid:** Fast search & category filtering.
    - [ ] **Cart Logic:** Local-first state (Zustand) so it works even if internet flickers.
2.  **Transaction Schema:**
    - [ ] **Schema Update:** Create `Transaction` table (distinct from online `Order`) to support:
        - Payment Methods (Cash, QR, Split).
        - Shift Management (Opening/Closing Cash).
3.  **Stock Integration:**
    - [ ] Auto-decrement stock upon checkout completion.

### Phase 3: The "Control" Engine (Finance & Insights) (Week 4)
*Goal: The "Business Control" aspect. Translate data into decisions.*

1.  **Finance Engine:**
    - [ ] **COGS Calculation:** Calculate exact profit per transaction (`Sell Price - Material Cost`).
    - [ ] **OPEX Recorder:** Simple entry for non-COGS expenses (Rent, Electricity).
    - [ ] **P&L View:** Real-time Profit & Loss report.
2.  **Actionable Inbox:**
    - [ ] **Auto-Alerts:** "Stock Low" triggers a "Draft PO" action.
    - [ ] **Weekly Reports:** Auto-generate PDF summaries for the owner.

---

## 🛠 Technical Focus Areas

### A. Missing Pieces (To Build)
- **POS Transaction Table:** The current `Order` table is designed for E-commerce/Delivery. We need a leaner `PosTransaction` table.
- **Cash Flow Table:** Need to track `Expense` separate from `PurchaseOrder`.

### B. The AI Edge
- **Data Ingestion:** We will use the Vercel AI SDK to stream column mapping suggestions during import.
- **Insights:** We will use simple heuristics first, then AI Analysis for "Anomaly Detection" later.

### C. Immediate Action
**Start with Phase 0.** Fix the UI/Theme inconsistencies to establish the "Premium Application" standard mentioned in your request.
