# Features Overview

## Core Features

### Inventory Management

#### Materials (Ingredients)

- Create, update, delete materials
- Track current stock levels
- Set minimum/maximum stock thresholds
- Low stock alerts
- Multiple suppliers per material
- Preferred supplier pricing
- CSV export

#### Products

- Product catalog management
- Cost and selling price tracking
- Profit margin calculation
- Stock tracking
- Recipe linkage
- CSV export

#### Recipes

- Recipe creation with ingredients
- Automatic cost calculation
- Yield and unit tracking
- Production time estimates
- Recipe duplication
- Ingredient usage tracking

---

### Supply Chain

#### Suppliers

- Supplier directory
- Contact information management
- Material-supplier relationships
- Price tracking per supplier

#### Supplier Orders

- Create purchase orders
- Track order status (Pending → Placed → Received)
- Automatic stock updates on receipt
- Order history

---

### Production

#### Production Batches

- Plan production runs
- Link recipes to products
- Schedule production dates
- Track batch status:
  - **Planned** - Created, not started
  - **In Progress** - Materials consumed
  - **Completed** - Products added to stock
  - **Cancelled** - Production cancelled

#### Stock Movements

- Automatic tracking for:
  - Purchases
  - Production (in/out)
  - Sales
  - Adjustments
  - Waste
- Full audit trail
- Filter by type, date, item

---

### Dashboard

#### Overview

- Quick stats (products, materials, orders)
- Low stock alerts
- Upcoming production
- Recent activity

#### Alerts

- Low stock warnings
- Critical stock alerts
- Production reminders
- System notifications

---

### User Management

#### Profile

- User information
- Locale preference
- Currency preference
- Timezone setting

#### Business

- Business profile
- Multi-store support
- Store management

---

### Billing

#### Subscription Plans

| Feature          | Starter | Pro       |
| ---------------- | ------- | --------- |
| Stores           | 1       | Unlimited |
| Products         | 500     | Unlimited |
| Export CSV       | ❌      | ✅        |
| Advanced Reports | ❌      | ✅        |
| Priority Support | ❌      | ✅        |

#### Stripe Integration

- Secure checkout
- Customer portal
- Subscription management
- Webhook handling

---

### Multi-language Support

- English
- French
- Indonesian

All UI elements, form labels, validation messages, and notifications are fully translated.

---

### Responsive Design

- Desktop optimized
- Tablet support
- Mobile-friendly navigation
