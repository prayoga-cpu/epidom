# **EPIDOM Client Personas & Use Cases**

## **1\. Client Personas**

### **Persona 1: Bakery Owner (Primary Target)**

Bakery owner or Head Baker/Production Manager, aged 38-55 (typically 42-50), with 8-20 years of experience, located in urban or suburban areas. They have moderate tech literacy, comfortable using smartphones, WhatsApp, Instagram, and Excel or Google Sheets for recipes. They may have tried simple store or sales apps before but tend to be cautious about adopting new technology, requiring a clear return on investment (ROI).
Their daily task focusing on production: batch baking, quality control, daily sales, and next-day planning. Their work involves complex recipes with 10-20 ingredients, managing perishables like flour, eggs, and dairy, and estimating production needs manually within a repetitive schedule.

**Pain points:**

- Complex recipes (10-20 ingredients); manual cost-per-batch calculation is difficult.
- Perishables require tight production planning.
- Overproduction or underproduction due to lack of precise cost per item.
- No tracking for items nearing expiry.
- Manual supplier ordering (via WhatsApp/phone) leads to missed or untracked orders.

**Goals:**

- Achieve accurate cost-per-item pricing.
- Optimize production and minimize over/underproduction.
- Improve ingredient tracking to avoid waste.
- Implement more systematic production planning.
- Automate ordering and reminders.

**Why EPIDOM:**

- Production batch tracking aligns with their workflow.
- Recipe cost calculation supports better pricing decisions.
- Production planning tools improve optimization.
- Inventory tracking reduces waste.
- €29/month plan provides ROI through waste reduction and cost control.

### **Persona 2: Food Manufacturer Owner (Secondary Target)**

Owner or Production Manager of a small-to-medium food manufacturing business, aged 40-65, with 10-25 years of experience, typically located in industrial or suburban areas. They have moderate-to-high tech literacy, familiar with Excel tracking, production systems, and simple inventory or production software. They value efficiency, scalability, and precision in operations.

Their daily routine involves managing complex, multi-step production processes, maintaining large inventories of raw materials, tracking production batches, ensuring quality control, managing suppliers, and ensuring compliance and traceability. Their operations are more industrial and data-dependent, requiring structured systems to support scaling.

**Pain points:**

- Complex production workflows make batch and quality tracking difficult.
- Managing large raw material inventories in real time is challenging.
- Lack of clear batch-level cost tracking for pricing decisions.
- Traceability from supplier to product is poor.
- Supplier management is manual and unsystematic.
- Existing systems lack scalability for growth.

**Goals:**

- Improve production planning and tracking systems.
- Track production costs accurately.
- Ensure quality control and traceability.
- Reduce waste and improve operational efficiency.
- Scale operations with robust, centralized systems.
- Manage multiple suppliers effectively.

**Why EPIDOM:**

- Production batch tracking supports detailed workflows.
- Recipe cost calculation enables precise cost control.
- Multi-store support allows for scalable operations.
- Supplier management tools improve operational efficiency.
- Inventory tracking enhances traceability.
- Pro (€79/month) or Enterprise plan suits multi-location businesses.

### **Persona 3: Restaurant Owner/Manager (Tertiary Target)**

Restaurant owner or operations manager aged 35-50 (typically 40-45), with 5-15 years of experience, located in urban environments. They have moderate-to-high tech literacy - proficient with smartphones, tablets, WhatsApp Business, Instagram, and Google Sheets/Excel. They use POS and delivery apps and are comfortable with web apps but might need assistance navigating more complex features.

Their daily routine is fast-paced and multitasking. Morning activities include prep work, stock checking, and receiving ingredients. Afternoons are focused on service, evenings on administration and purchasing, and nights on manual stock counts and next-day planning. Their operations are on-demand (not batch-based) and time-sensitive, with frequent manual tracking that can lead to oversight.

**Pain points:**

- Stockouts occur during service without warning.
- Manual stock counting (notebook/spreadsheet) is error-prone or forgotten.
- Difficult to calculate accurate cost per dish due to fluctuating ingredient prices.
- No visibility on items nearing expiry.
- Supplier orders are unorganized or delayed.
- Lack of consolidated data for decision-making.

**Goals:**

- Prevent stockouts during service hours.
- Reduce stock counting time from 1-2 hours to 15-30 minutes.
- Maintain accurate cost per menu item for pricing.
- Reduce ingredient waste by 20-30%.
- Create a more planned and traceable ordering process.

**Why EPIDOM (with notes):**

- Inventory tracking with real-time stock alerts prevents shortages.
- Recipe cost calculation enables menu pricing optimization.
- Supplier management ensures systematic ordering.
- Alert system helps prevent service-time stockouts.
- Optional production tracking for pre-made items (sauces, marinades).
- €29/month plan offers solid ROI for inventory management.

**Note:** Messaging should emphasize _"Inventory management with recipe cost calculation"_, not _"production management."_

### **Common Traits**

**Common traits:**

- Business-focused: seeks profit and efficiency.
- Time-constrained: limited availability for manual processes.
- Cost-conscious: aims to reduce waste and control costs.
- Growth-oriented: interested in scaling sustainably.
- Data-driven: values analytics for decision-making.

**Technology preferences:**

- Comfortable with SaaS (cloud-based) platforms.
- Prefers mobile-friendly access for on-the-go management.
- Open to integrations with existing systems.
- Willing to learn new tools if benefits are clear.
- Budget-aware, expecting ROI through efficiency gains.

**Messages:**

- Emphasize ROI and cost savings (waste reduction, time savings, cost control).
- Highlight practical value: real-time tracking, automated alerts, and cost calculation.
- Focus on user-friendliness and mobile accessibility.
- Backed by proof: case studies, testimonials, and performance metrics (e.g., waste reduction and time savings).
- For Bakery/Food Manufacturer: stress _"production-focused inventory management."_
- For Restaurant: stress _"inventory management with recipe cost calculation."_

## **2\. Use Cases**

**Use Case 1: Bakery Owner - Daily Production Planning**

Scenario: Bakery owner plans the day's production and tracks batch production. Actor: Bakery Owner (Persona 1) Preconditions: User logged in, subscription active, store created, materials and recipes added.

Main Flow:

- Morning (06:00): Login, select store.
- Navigate to Management → Recipe Production.
- Select product to produce (e.g., "Chocolate Cake").
- Check material availability:
  - System checks stock for flour, sugar, eggs, chocolate.
  - Shows status: sufficient, low, or insufficient.
- If sufficient, create production batch:
  - Set planned quantity (e.g., 10 cakes).
  - Set scheduled date (today).
  - System auto-generates batch number (e.g., "BATCH-20250115-001").
- Start production:
  - System deducts materials from stock.
  - Creates stock movements (PRODUCTION_OUT).
  - Batch status: PLANNED → IN_PROGRESS.
- During production: Track progress in Production History.
- Complete production:
  - Update actual quantity (e.g., 9 cakes due to waste).
  - System adds finished products to stock.
  - Creates stock movements (PRODUCTION_IN).
  - Batch status: IN_PROGRESS → COMPLETED.
- View production history: Check metrics (planned vs actual, cost per batch).

Postconditions:

- Materials deducted from stock.
- Finished products added to stock.
- Production batch tracked with history.
- Cost per batch calculated automatically.

Alternative Flows:

- Material insufficient: System shows which materials are low, user orders from supplier first.
- Production canceled: System can restore materials to stock (optional).

Business Value:

- Accurate production tracking.
- Automatic cost calculation per batch.
- Better production planning with material availability checks.
- Reduced waste through tracking.

**Use Case 2: Bakery Owner - Recipe Cost Calculation for Pricing**

Scenario: Bakery owner creates a new recipe and calculates cost for pricing. Actor: Bakery Owner (Persona 1) Preconditions: User logged in, store created, materials added with current prices.

Main Flow:

- Navigate to Data → Recipes.
- Create new recipe (e.g., "Red Velvet Cake").
- Add recipe details:
  - Name: "Red Velvet Cake"
  - Yield: 8 cakes
  - Yield unit: "piece"
  - Production time: 120 minutes
- Add ingredients:
  - Flour: 500g (€0.50/kg)
  - Sugar: 300g (€0.80/kg)
  - Eggs: 4 pcs (€0.20/piece)
  - Butter: 200g (€4.00/kg)
  - Cocoa powder: 50g (€8.00/kg)
  - Red coloring: 10ml (€2.00/100ml)
- System calculates:
  - Cost per batch: €X.XX.
  - Cost per cake: €X.XX (batch/quantity).
- Set selling price (e.g., €15.00/cake).
- View profit margin: system shows per cake.
- Save recipe and link to product for production tracking.

Postconditions:

- Recipe created with automatic cost calculation.
- Cost per batch and item calculated.
- Recipe available for production planning.

Business Value:

- Accurate pricing decisions.
- Profit margin visibility.
- Consistent recipe costing.

**Use Case 3: Bakery Owner - Low Stock Alert & Supplier Ordering**

Scenario: Bakery owner receives low stock alerts and places supplier orders. Actor: Bakery Owner (Persona 1) Preconditions: User logged in, materials added with min/max stock levels, suppliers added.

Main Flow:

- Morning check: Navigate to Alerts page.
- View low stock alerts:
  - Shows materials with currentStock ≤ minStock.
  - Sorted by severity.
- Review alert details:
  - Material: "Flour" - Current: 2kg, Min: 10kg.
  - Severity: CRITICAL.
- Place supplier order:
  - Click "Place Order".
  - Select supplier.
  - Enter quantity, unit price, and delivery date.
  - System calculates subtotal, tax, shipping, total.
  - Submit order: status → PENDING.
- Track order:
  - PENDING → PLACED → RECEIVED.
  - On receipt, system adds materials to stock and resolves alert.

Postconditions:

- Supplier order created and tracked.
- Materials restocked automatically.

Business Value:

- Prevents stockouts.
- Streamlines supplier management.
- Improves inventory accuracy.

**Use Case 4: Food Manufacturer Owner - Multi-Batch Production Tracking**

Scenario: Food manufacturer tracks multiple batches across products. Actor: Food Manufacturer Owner (Persona 2) Preconditions: User logged in, Pro/Enterprise subscription, store created, materials and recipes added.

Main Flow:

- Morning planning: View all active batches.
- Start multiple batches:
  - Batch 1: "Tomato Sauce" - 100 bottles.
  - Batch 2: "BBQ Sauce" - 80 bottles.
  - Batch 3: "Hot Sauce" - 120 bottles.
- Check material availability for all.
- Start production for each batch.
- Track progress and complete batches with actual quantities.
- View total metrics: planned vs actual, waste %, cost per batch.

Postconditions:

- Multi-batch tracking complete.
- Metrics recorded.
- Waste tracked for optimization.

Business Value:

- Efficiency and transparency.
- Cost control.
- Improved production planning.

**Use Case 5: Food Manufacturer Owner - Supplier Performance Monitoring**

Scenario: Monitors supplier performance and manages multiple suppliers. Actor: Food Manufacturer Owner (Persona 2) Preconditions: User logged in, suppliers added with material pricing.

Main Flow:

- View supplier list with pricing.
- Compare suppliers (A: €2.00/kg, B: €2.20/kg, C: €1.90/kg).
- Set preferred suppliers per material.
- Place multiple orders across suppliers.
- Track order statuses and delivery performance.
- Update pricing and contact info.

Postconditions:

- Supplier data maintained.
- Price comparisons available.

Business Value:

- Cost savings.
- Better supplier efficiency.
- Streamlined order management.

**Use Case 6: Restaurant Owner - Inventory Tracking & Cost Control**

Scenario: Tracks inventory and calculates menu item costs. Actor: Restaurant Owner (Persona 3) Preconditions: Starter subscription active, store created, materials added.

Main Flow:

- Check current stock.
- Navigate to Alerts → View low stock items.
- Place supplier orders.
- Calculate menu costs (e.g., "Beef Steak"): ingredients and portion costs.
- Set menu price and profit margin.
- Adjust stock manually for waste/damage.

Postconditions:

- Inventory updated in real-time.
- Menu costs accurate.

Business Value:

- Prevents service stockouts.
- Reduces waste.
- Improves pricing decisions.

**Use Case 7: Restaurant Owner - Recipe Cost Calculation for Menu Pricing**

Scenario: Calculates cost for a new menu item. Actor: Restaurant Owner (Persona 3) Preconditions: Materials added with current prices.

Main Flow:

- Create new recipe ("Chicken Pasta").
- Add ingredients and quantities.
- System calculates cost per batch and per serving.
- Set selling price, view margin.
- Link recipe to product for tracking.

Postconditions:

- Recipe cost calculated and saved.

Business Value:

- Accurate pricing.
- Consistent cost tracking.

**Use Case 8: Multi-Store Food Business - Centralized Management**

Scenario: Manage multiple stores' inventories. Actor: Food Manufacturer Owner / Multi-Store Manager (Persona 2) Preconditions: Pro/Enterprise subscription, multiple stores created.

Main Flow:

- View all stores.
- Switch between Store A, B, C.
- Compare stock levels and alerts.
- Manage orders per store.
- Centralize data for management.

Postconditions:

- Multi-store visibility.

Business Value:

- Centralized control.
- Scalable operations.

**Use Case 9: Daily Inventory Check & Stock Adjustment**

Scenario: User adjusts stock after physical check. Actor: Any User (Bakery, Manufacturer, Restaurant) Preconditions: Store created, materials added.

Main Flow:

- Navigate to Tracking page.
- Compare physical vs system stock.
- Record discrepancies with reason.
- System updates stock and logs adjustment.

Postconditions:

- Stock corrected.
- Audit trail saved.

Business Value:

- Accurate inventory.
- Waste tracking.

**Use Case 10: Production History & Analytics**

Scenario: User views analytics and production history. Actor: Any User (Bakery, Manufacturer, Restaurant) Preconditions: Completed production batches.

Main Flow:

- Navigate to Production History.
- Filter and view metrics.
- Analyze production trends and waste.
- View dashboard insights.

Postconditions:

- Metrics available for optimization.

Business Value:

- Data-driven planning.
- Waste reduction.

### **Summary of Use Cases**

By Persona:

- Bakery Owner: Production planning, recipe costing, low stock alerts.
- Food Manufacturer Owner: Multi-batch tracking, supplier management, multi-store operations.
- Restaurant Owner: Inventory tracking, cost control, menu pricing.

Common Use Cases: Inventory check, supplier management, recipe costing, analytics.

Supported Features:

- Inventory Management
- Recipe Management
- Production Management
- Supplier Management
- Alert System
- Multi-Store Support
- Analytics Dashboard
