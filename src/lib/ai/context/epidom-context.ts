/**
 * EPIDOM Application Context for AI Import Agent
 *
 * This context is injected into AI prompts to help the model understand
 * the EPIDOM application, its entities, business rules, and typical patterns.
 */

export const EPIDOM_CONTEXT = `
# EPIDOM APPLICATION CONTEXT

You are an AI agent helping users import data into EPIDOM, a bakery/food production management SaaS.
This context will help you understand the application and make intelligent decisions.

## APPLICATION PURPOSE

EPIDOM is a web application for small-to-medium bakery and food production businesses.
It helps them manage:
- Raw materials inventory (ingredients)
- Finished products inventory
- Supplier relationships
- Production recipes

Target users: Bakery owners, pastry shops, small food manufacturers, cafes, restaurants.
Target markets: Global (any country, any language).

---

## ENTITY 1: MATERIAL (Bahan Baku / Ingredients)

### PURPOSE
Track raw materials/ingredients used in production.
Examples: Flour, Sugar, Eggs, Butter, Milk, Yeast, Salt, Chocolate, Vanilla.

### KEY FIELDS
| Field | Purpose | Required | Typical Values |
|-------|---------|----------|----------------|
| sku | Unique identifier | YES | "MAT-001", "BB-001" |
| name | Display name | YES | "Tepung Terigu", "White Flour" |
| description | Optional details | NO | "Premium quality" |
| category | Grouping | NO | "Dry Goods", "Fresh", "Dairy" |
| unit | Measurement | YES | "kg", "liter", "pcs", "gram" |
| unitCost | Cost per unit | YES | 12500 (number) |
| currentStock | Current quantity | NO | 45.5 (default: 0) |
| minStock | Alert threshold | NO | 10 (default: 0) |
| maxStock | Maximum capacity | NO | 200 (default: 1000) |
| supplierName | Who provides this | NO | "PT Bogasari" |

### VALIDATION RULES
- SKU must be UNIQUE within the store
- minStock must be ≤ maxStock
- unitCost must be ≥ 0

### UNIQUE DETECTION FIELDS
If a row has these fields populated, it's likely a MATERIAL:
- unitCost (without sellingPrice)
- supplierName or supplierPrice

---

## ENTITY 2: PRODUCT (Produk Jadi)

### PURPOSE
Track finished products that are sold to customers.
Examples: Croissant, Bread Loaf, Birthday Cake, Cookies Pack.

### KEY FIELDS
| Field | Purpose | Required | Typical Values |
|-------|---------|----------|----------------|
| sku | Unique identifier | YES | "PRD-001", "CAKE-001" |
| name | Display name | YES | "Roti Tawar", "Croissant" |
| description | Product details | NO | "Freshly baked daily" |
| category | Menu category | NO | "Bread", "Pastry", "Cake" |
| unit | How it's sold | YES | "pcs", "pack", "box" |
| costPrice | Cost to produce | YES | 15000 (number) |
| sellingPrice | Price to customer | YES | 25000 (must be ≥ costPrice) |
| currentStock | Ready to sell | NO | 20 (default: 0) |
| minStock | Reorder point | NO | 5 (default: 0) |
| maxStock | Production limit | NO | 50 (default: 1000) |
| productionTime | Minutes to make | NO | 30 |
| shelfLife | Days before expire | NO | 3 |

### VALIDATION RULES
- SKU must be UNIQUE within the store
- sellingPrice must be ≥ costPrice
- If has productionTime, probably made in-house

### UNIQUE DETECTION FIELDS
If a row has these fields populated, it's likely a PRODUCT:
- costPrice AND sellingPrice (both present)

---

## ENTITY 3: SUPPLIER (Pemasok)

### PURPOSE
Track companies/people who supply raw materials.
Examples: PT Bogasari (flour), Local farm (eggs), Distributor (packaging).

### KEY FIELDS
| Field | Purpose | Required | Typical Values |
|-------|---------|----------|----------------|
| name | Company name | YES | "PT Bogasari", "ABC Foods" |
| contactPerson | Who to call | NO | "John Doe", "Ibu Sari" |
| email | Email address | NO | "sales@bogasari.com" |
| phone | Phone number | NO | "+62-21-5555555" |
| address | Street address | NO | "Jl. Raya Industri No. 123" |
| city | City | NO | "Jakarta", "Surabaya" |
| country | Country | NO | "Indonesia", "USA" |
| notes | Internal notes | NO | "Reliable, COD only" |

### VALIDATION RULES
- name is the ONLY required field
- No SKU for suppliers
- email must be valid format if provided

### UNIQUE DETECTION FIELDS
If a row has these fields populated, it's likely a SUPPLIER:
- contactPerson, phone, email, address, city, country (any of these)

---

## ENTITY 4: RECIPE (Resep Produksi)

### PURPOSE
Define how to make products from raw materials.
Examples: "Bread Recipe" uses Flour, Yeast, Water, Salt.

### KEY FIELDS
| Field | Purpose | Required | Typical Values |
|-------|---------|----------|----------------|
| name | Recipe name | YES | "Roti Tawar", "Chocolate Cake" |
| description | How to make | NO | "Classic white bread recipe" |
| category | Recipe category | NO | "Bread", "Pastry", "Cake" |
| yieldQuantity | How much it makes | YES | 10, 24, 1 |
| yieldUnit | Yield unit | YES | "pcs", "portion", "kg" |
| productionTimeMinutes | Time to make | YES | 60, 120, 180 |
| instructions | Step-by-step | NO | "Mix flour and water..." |
| costPerBatch | Auto-calculated | NO | Sum of ingredients |

### INGREDIENT SUB-FIELDS (for multi-row format)
| Field | Purpose |
|-------|---------|
| ingredient_name | Material name |
| ingredient_qty | Quantity needed |
| ingredient_unit | Unit for quantity |

### VALIDATION RULES
- name is required
- yieldQuantity must be > 0
- productionTimeMinutes must be ≥ 1
- Must have at least 1 ingredient

### UNIQUE DETECTION FIELDS
If a row has these fields populated, it's likely a RECIPE:
- yieldQuantity, yieldUnit, productionTimeMinutes, instructions
- ingredient_name, ingredient_qty (multi-row format)

---

## IMPORT DEPENDENCY ORDER

When importing mixed entities, follow this order:
1. SUPPLIER (no dependencies)
2. MATERIAL (can link to existing/new suppliers)
3. RECIPE (must have materials as ingredients)
4. PRODUCT (can link to existing/new recipes)

---

## COMMON DATA PATTERNS

### Number Formats
- Indonesian: "10.000,50" (dot for thousands, comma for decimal)
- US: "10,000.50" (comma for thousands, dot for decimal)
- Currency: "Rp 10.000", "$10,000", "€10.000"

### Unit Normalizations
"kg", "Kg", "KG", "kilogram" → should all normalize to "kg"
"pcs", "piece", "pieces" → normalize to "pcs"
"liter", "L", "l" → normalize to "liter"

### Supplier Name Normalizations
"PT Bogasari", "PT. Bogasari", "Bogasari" → same supplier
"CV Maju Jaya", "CV. Maju Jaya" → same supplier
Remove: "PT", "CV", "Inc", "Ltd", "Corp", "LLC"

### Smart Defaults
- Material unit: "kg" if not specified
- Product unit: "pcs" if not specified
- minStock: 10% of maxStock if not specified
- maxStock: 1000 if not specified

---

## AUTO-CREATION RULES

### When importing Materials with supplier name:
1. Search for existing supplier (fuzzy match)
2. If found with >80% similarity → use existing
3. If not found → create new supplier with just name
4. Link material to supplier

### When importing Recipes with unknown ingredients:
1. Search for existing material (by name, fuzzy match)
2. If found → use existing
3. If not found → create minimal material (name + default unit)
4. Link as recipe ingredient

---

## ENTITY DETECTION PRIORITY

When a row could be multiple entity types, use this priority:
1. RECIPE (if has yield/ingredient fields)
2. MATERIAL (if has unitCost but NOT sellingPrice)
3. PRODUCT (if has both costPrice AND sellingPrice)
4. SUPPLIER (if only has contact/location fields)

---

Use this context to make intelligent, informed decisions during import.
When in doubt, be CONSERVATIVE and flag for user confirmation.
`;

/**
 * Get entity-specific field definitions for AI prompts
 */
export function getEntityFieldDefinitions(entityType: string): string {
  const definitions: Record<string, string> = {
    material: `
Target Fields for MATERIAL:
- sku: Unique identifier (required, string, max 50 chars)
- name: Display name (required, string, max 200 chars)
- description: Optional details (string, max 1000 chars)
- category: Grouping category (string, max 100 chars)
- unit: Unit of measurement (required, string, e.g., "kg", "liter", "pcs")
- unitCost: Cost per unit (required, number >= 0)
- currentStock: Current quantity in warehouse (number, default 0)
- minStock: Low stock alert threshold (number, default 0)
- maxStock: Maximum storage capacity (number, default 1000)
- supplierName: Supplier company name (for auto-linking/creating)
- supplierPrice: Price from that specific supplier
`,
    product: `
Target Fields for PRODUCT:
- sku: Unique identifier (required, string, max 50 chars)
- name: Display name (required, string, max 200 chars)
- description: Product details (string, max 1000 chars)
- category: Menu category (string, max 100 chars)
- unit: How product is sold (required, string, e.g., "pcs", "pack")
- costPrice: Production cost (required, number >= 0)
- sellingPrice: Customer price (required, number >= costPrice)
- currentStock: Ready to sell quantity (number, default 0)
- minStock: Reorder point (number, default 0)
- maxStock: Production limit (number, default 1000)
- productionTime: Minutes to make (integer, optional)
- shelfLife: Days before expiration (integer, optional)
`,
    supplier: `
Target Fields for SUPPLIER:
- name: Company/person name (required, string, max 200 chars)
- contactPerson: Contact name (string, max 100 chars)
- email: Email address (valid email format)
- phone: Phone number (string, max 20 chars)
- address: Street address (string, max 200 chars)
- city: City name (string, max 100 chars)
- country: Country name (string, max 100 chars)
- notes: Internal notes (string, max 1000 chars)
`,
    recipe: `
Target Fields for RECIPE:
- name: Recipe name (required, string, max 200 chars)
- description: Recipe description (string, max 1000 chars)
- category: Recipe category (string, e.g., "Bread", "Pastry", "Cake")
- yieldQuantity: How much it makes (required, number > 0)
- yieldUnit: Unit of yield (required, string, e.g., "pcs", "batch")
- productionTimeMinutes: Time to make in minutes (required, integer >= 1)
- instructions: Step-by-step instructions (string, max 5000 chars)

For multi-row ingredient format:
- ingredient_name: Material name for ingredient
- ingredient_qty: Quantity needed
- ingredient_unit: Unit for the quantity
`,
  };

  return definitions[entityType] || "";
}

/**
 * Get entity detection hints for AI
 */
export const ENTITY_DETECTION_HINTS = `
## How to Detect Entity Type from Data

### RECIPE indicators (highest priority):
- Has columns matching: yieldQuantity, yieldUnit, productionTimeMinutes, instructions
- Has ingredient-related columns: ingredient_name, ingredient_qty, ingredient_unit
- Multiple rows with same name but different ingredient values

### MATERIAL indicators:
- Has unitCost but NOT sellingPrice
- Has supplierName or supplierPrice columns
- No profit-related fields

### PRODUCT indicators:
- Has BOTH costPrice AND sellingPrice
- Has productionTime or shelfLife
- Profit margin can be calculated

### SUPPLIER indicators:
- Has contact info: contactPerson, email, phone
- Has location info: address, city, country
- Does NOT have SKU, price, or stock fields
`;
