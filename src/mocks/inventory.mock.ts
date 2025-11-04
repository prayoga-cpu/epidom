/**
 * Enhanced mock data for inventory management
 * TODO: Replace with real API calls to /api/materials, /api/recipes, /api/products, /api/suppliers, /api/stock
 */

import {
  Material,
  Recipe,
  Product,
  Supplier,
  StockMovement,
  ProductionBatch,
  RecipeIngredient,
  ProductVariant,
  MaterialCategory,
  MovementType,
  ProductionStatus,
  PaymentTerms,
} from "@/types/entities";

// ============================================================================
// SIMPLE TYPES (for backward compatibility)
// ============================================================================

export interface Item {
  id: string;
  name: string;
  note?: string;
}

export interface StockRow {
  id: string;
  product: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
}

export interface ChartDataPoint {
  date: string;
  qty: number;
}

// ============================================================================
// SUPPLIERS
// ============================================================================

export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: "SUP-001",
    name: "Grain & Co",
    contactPerson: "Jean Dupont",
    email: "contact@grainco.com",
    phone: "+33 1 23 45 67 89",
    address: "15 Rue de la Boulangerie",
    city: "Paris",
    country: "France",
    paymentTerms: PaymentTerms.NET30,
    deliverySchedule: "Monday, Wednesday, Friday",
    rating: 4.5,
    notes: "Primary flour supplier, excellent quality",
    storeId: "STORE-001",
    onTimeDeliveryRate: 95,
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-10-20"),
  },
  {
    id: "SUP-002",
    name: "DairyFresh",
    contactPerson: "Marie Laurent",
    email: "marie@dairyfresh.com",
    phone: "+33 1 98 76 54 32",
    address: "42 Avenue des Laitiers",
    city: "Lyon",
    country: "France",
    paymentTerms: PaymentTerms.NET15,
    deliverySchedule: "Tuesday, Thursday",
    rating: 4.8,
    notes: "Butter and dairy products",
    storeId: "STORE-001",
    onTimeDeliveryRate: 98,
    createdAt: new Date("2024-01-20"),
    updatedAt: new Date("2024-10-18"),
  },
  {
    id: "SUP-003",
    name: "Global Ingredients Ltd",
    contactPerson: "Ahmed Hassan",
    email: "ahmed@globalingredients.com",
    phone: "+33 2 34 56 78 90",
    address: "8 Boulevard du Commerce",
    city: "Marseille",
    country: "France",
    paymentTerms: PaymentTerms.NET30,
    deliverySchedule: "Weekly delivery on Mondays",
    rating: 4.2,
    notes: "Spices, nuts, and specialty ingredients",
    storeId: "STORE-001",
    onTimeDeliveryRate: 89,
    createdAt: new Date("2024-02-10"),
    updatedAt: new Date("2024-10-15"),
  },
  {
    id: "SUP-004",
    name: "Chocolate Masters",
    contactPerson: "Sophie Bernard",
    email: "sophie@chocolatemasters.fr",
    phone: "+33 4 56 78 90 12",
    address: "23 Rue du Cacao",
    city: "Bordeaux",
    country: "France",
    paymentTerms: PaymentTerms.COD,
    deliverySchedule: "On demand",
    rating: 4.9,
    notes: "Premium chocolate supplier",
    storeId: "STORE-001",
    onTimeDeliveryRate: 100,
    createdAt: new Date("2024-03-05"),
    updatedAt: new Date("2024-10-22"),
  },
];

// Simple supplier items (for backward compatibility)
export const MOCK_SUPPLIER_ITEMS: Item[] = MOCK_SUPPLIERS.map((s) => ({
  id: s.id,
  name: s.name,
  note: s.notes,
}));

// ============================================================================
// MATERIALS
// ============================================================================

export const MOCK_MATERIALS: Material[] = [
  {
    id: "MAT-001",
    name: "Flour T55",
    sku: "FLR-T55-25KG",
    category: MaterialCategory.GRAINS,
    description: "Premium French wheat flour type 55, ideal for bread and pastries",
    supplierId: "SUP-001",
    unit: "kg",
    costPerUnit: 1.2,
    currentStock: 250,
    minStock: 50,
    maxStock: 500,
    location: "Storage Room A, Shelf 1",
    barcode: "3456789012345",
    storeId: "STORE-001",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-10-28"),
  },
  {
    id: "MAT-002",
    name: "Butter AOP",
    sku: "BUT-AOP-1KG",
    category: MaterialCategory.DAIRY,
    description: "Premium AOP certified French butter",
    supplierId: "SUP-002",
    unit: "kg",
    costPerUnit: 8.5,
    currentStock: 45,
    minStock: 20,
    maxStock: 100,
    location: "Cold Storage, Section B",
    barcode: "3456789012346",
    storeId: "STORE-001",
    createdAt: new Date("2024-01-20"),
    updatedAt: new Date("2024-10-27"),
  },
  {
    id: "MAT-003",
    name: "Sugar",
    sku: "SUG-WHT-25KG",
    category: MaterialCategory.RAW_MATERIALS,
    description: "White granulated sugar",
    supplierId: "SUP-001",
    unit: "kg",
    costPerUnit: 0.85,
    currentStock: 180,
    minStock: 40,
    maxStock: 300,
    location: "Storage Room A, Shelf 3",
    barcode: "3456789012347",
    storeId: "STORE-001",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-10-26"),
  },
  {
    id: "MAT-004",
    name: "Almonds",
    sku: "NUT-ALM-5KG",
    category: MaterialCategory.OTHER,
    description: "Whole blanched almonds",
    supplierId: "SUP-003",
    unit: "kg",
    costPerUnit: 12.5,
    currentStock: 25,
    minStock: 10,
    maxStock: 50,
    location: "Storage Room B, Shelf 2",
    barcode: "3456789012348",
    storeId: "STORE-001",
    createdAt: new Date("2024-02-10"),
    updatedAt: new Date("2024-10-25"),
  },
  {
    id: "MAT-005",
    name: "Yeast",
    sku: "YST-DRY-500G",
    category: MaterialCategory.RAW_MATERIALS,
    description: "Dry active yeast",
    supplierId: "SUP-001",
    unit: "g",
    costPerUnit: 0.015,
    currentStock: 5000,
    minStock: 1000,
    maxStock: 10000,
    location: "Storage Room A, Shelf 5",
    barcode: "3456789012349",
    storeId: "STORE-001",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-10-28"),
  },
  {
    id: "MAT-006",
    name: "Eggs",
    sku: "EGG-LRG-30CT",
    category: MaterialCategory.DAIRY,
    description: "Large fresh eggs",
    supplierId: "SUP-002",
    unit: "units",
    costPerUnit: 0.25,
    currentStock: 360,
    minStock: 120,
    maxStock: 600,
    location: "Cold Storage, Section A",
    barcode: "3456789012350",
    storeId: "STORE-001",
    createdAt: new Date("2024-01-20"),
    updatedAt: new Date("2024-10-28"),
  },
  {
    id: "MAT-007",
    name: "Dark Chocolate 70%",
    sku: "CHO-DRK-70-1KG",
    category: MaterialCategory.OTHER,
    description: "Premium dark chocolate couverture 70% cocoa",
    supplierId: "SUP-004",
    unit: "kg",
    costPerUnit: 18.0,
    currentStock: 15,
    minStock: 5,
    maxStock: 40,
    location: "Cool Room, Shelf 1",
    barcode: "3456789012351",
    storeId: "STORE-001",
    createdAt: new Date("2024-03-05"),
    updatedAt: new Date("2024-10-27"),
  },
  {
    id: "MAT-008",
    name: "Salt",
    sku: "SLT-SEA-5KG",
    category: MaterialCategory.SPICES,
    description: "Fine sea salt",
    supplierId: "SUP-003",
    unit: "kg",
    costPerUnit: 1.5,
    currentStock: 40,
    minStock: 10,
    maxStock: 50,
    location: "Storage Room A, Shelf 4",
    barcode: "3456789012352",
    storeId: "STORE-001",
    createdAt: new Date("2024-02-10"),
    updatedAt: new Date("2024-10-20"),
  },
];

// Simple material items (for backward compatibility)
export const MOCK_MATERIAL_ITEMS: Item[] = MOCK_MATERIALS.slice(0, 6).map((m) => ({
  id: m.id,
  name: m.name,
}));

// ============================================================================
// RECIPES
// ============================================================================

export const MOCK_RECIPE_INGREDIENTS: RecipeIngredient[] = [
  // Baguette Tradition ingredients
  {
    id: "RI-001",
    recipeId: "REC-001",
    materialId: "MAT-001",
    quantity: 1,
    unit: "kg",
    notes: "High-quality T55 flour",
  },
  { id: "RI-002", recipeId: "REC-001", materialId: "MAT-005", quantity: 20, unit: "g" },
  { id: "RI-003", recipeId: "REC-001", materialId: "MAT-008", quantity: 20, unit: "g" },

  // Croissant ingredients
  { id: "RI-004", recipeId: "REC-002", materialId: "MAT-001", quantity: 0.5, unit: "kg" },
  {
    id: "RI-005",
    recipeId: "REC-002",
    materialId: "MAT-002",
    quantity: 0.25,
    unit: "kg",
    notes: "For lamination",
  },
  { id: "RI-006", recipeId: "REC-002", materialId: "MAT-003", quantity: 0.1, unit: "kg" },
  { id: "RI-007", recipeId: "REC-002", materialId: "MAT-005", quantity: 10, unit: "g" },
  { id: "RI-008", recipeId: "REC-002", materialId: "MAT-006", quantity: 2, unit: "units" },

  // Brioche ingredients
  { id: "RI-009", recipeId: "REC-003", materialId: "MAT-001", quantity: 0.5, unit: "kg" },
  { id: "RI-010", recipeId: "REC-003", materialId: "MAT-002", quantity: 0.15, unit: "kg" },
  { id: "RI-011", recipeId: "REC-003", materialId: "MAT-003", quantity: 0.08, unit: "kg" },
  { id: "RI-012", recipeId: "REC-003", materialId: "MAT-006", quantity: 4, unit: "units" },
  { id: "RI-013", recipeId: "REC-003", materialId: "MAT-005", quantity: 8, unit: "g" },
];

export const MOCK_RECIPES: Recipe[] = [
  {
    id: "REC-001",
    name: "Baguette Tradition",
    description: "Traditional French baguette with crispy crust",
    category: "Bread",
    yieldQuantity: 3,
    yieldUnit: "units",
    productionTimeMinutes: 240,
    instructions:
      "1. Mix flour, water, salt, and yeast\n2. Knead for 10 minutes\n3. First rise for 90 minutes\n4. Shape into baguettes\n5. Second rise for 60 minutes\n6. Score and bake at 230°C for 25 minutes",
    costPerBatch: 2.4,
    costPerUnit: 0.8,
    storeId: "STORE-001",
    ingredients: MOCK_RECIPE_INGREDIENTS.filter((ri) => ri.recipeId === "REC-001"),
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-09-10"),
  },
  {
    id: "REC-002",
    name: "Croissant",
    description: "Buttery French croissant with multiple layers",
    category: "Pastry",
    yieldQuantity: 12,
    yieldUnit: "units",
    productionTimeMinutes: 480,
    instructions:
      "1. Prepare dough\n2. Laminate with butter (3 folds)\n3. Rest overnight\n4. Shape croissants\n5. Proof for 2 hours\n6. Egg wash and bake at 200°C for 18 minutes",
    costPerBatch: 8.5,
    costPerUnit: 0.71, // 8.5 / 12 units
    storeId: "STORE-001",
    ingredients: MOCK_RECIPE_INGREDIENTS.filter((ri) => ri.recipeId === "REC-002"),
    createdAt: new Date("2024-01-20"),
    updatedAt: new Date("2024-08-15"),
  },
  {
    id: "REC-003",
    name: "Brioche",
    description: "Rich and soft French brioche",
    category: "Bread",
    yieldQuantity: 2,
    yieldUnit: "loaves",
    productionTimeMinutes: 300,
    instructions:
      "1. Mix ingredients\n2. Knead until smooth and elastic\n3. First rise for 2 hours\n4. Shape into loaves\n5. Second rise for 90 minutes\n6. Egg wash and bake at 180°C for 35 minutes",
    costPerBatch: 5.2,
    costPerUnit: 2.6, // 5.2 / 2 loaves
    storeId: "STORE-001",
    ingredients: MOCK_RECIPE_INGREDIENTS.filter((ri) => ri.recipeId === "REC-003"),
    createdAt: new Date("2024-02-01"),
    updatedAt: new Date("2024-09-20"),
  },
  {
    id: "REC-004",
    name: "Pain au Chocolat",
    description: "Chocolate-filled pastry",
    category: "Pastry",
    yieldQuantity: 10,
    yieldUnit: "units",
    productionTimeMinutes: 360,
    instructions: "Similar to croissant dough with chocolate filling",
    costPerBatch: 12.0,
    costPerUnit: 1.2, // 12.0 / 10 units
    storeId: "STORE-001",
    ingredients: [],
    createdAt: new Date("2024-03-10"),
    updatedAt: new Date("2024-10-01"),
  },
];

// Simple recipe items (for backward compatibility)
export const MOCK_RECIPE_ITEMS: Item[] = MOCK_RECIPES.slice(0, 3).map((r) => ({
  id: r.id,
  name: r.name,
}));

// ============================================================================
// PRODUCTS
// ============================================================================

export const MOCK_PRODUCT_VARIANTS: ProductVariant[] = [
  {
    id: "VAR-001",
    productId: "PRO-001",
    name: "Demi Baguette",
    sku: "BAG-DEM",
    retailPrice: 1.5,
    wholesalePrice: 1.0,
    attributes: { size: "half" },
  },
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "PRO-001",
    name: "Baguette Tradition",
    sku: "BAG-TRD",
    description: "Traditional French baguette",
    recipeId: "REC-001",
    category: "Bread",
    retailPrice: 2.5,
    wholesalePrice: 1.8,
    costPrice: 0.8,
    unit: "unit",
    currentStock: 120,
    minStock: 30,
    maxStock: 200,
    imageUrl: "/images/products/baguette.jpg",
    storeId: "STORE-001",
    variants: [MOCK_PRODUCT_VARIANTS[0]],
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-10-15"),
  },
  {
    id: "PRO-002",
    name: "Croissant",
    sku: "CRS-BTR",
    description: "Butter croissant",
    recipeId: "REC-002",
    category: "Pastry",
    retailPrice: 1.8,
    wholesalePrice: 1.2,
    costPrice: 0.7,
    currentStock: 10,
    minStock: 5,
    maxStock: 50,
    unit: "unit",
    imageUrl: "/images/products/croissant.jpg",
    storeId: "STORE-001",
    createdAt: new Date("2024-01-20"),
    updatedAt: new Date("2024-10-12"),
  },
  {
    id: "PRO-003",
    name: "Pain au Chocolat",
    sku: "PAC-CHO",
    description: "Chocolate-filled pastry",
    recipeId: "REC-004",
    category: "Pastry",
    retailPrice: 2.2,
    wholesalePrice: 1.5,
    costPrice: 1.2,
    currentStock: 25,
    minStock: 10,
    maxStock: 50,
    unit: "unit",
    imageUrl: "/images/products/pain-chocolat.jpg",
    storeId: "STORE-001",
    createdAt: new Date("2024-03-10"),
    updatedAt: new Date("2024-10-10"),
  },
  {
    id: "PRO-004",
    name: "Brioche Loaf",
    sku: "BRI-LOF",
    description: "Soft and rich brioche loaf",
    recipeId: "REC-003",
    category: "Bread",
    retailPrice: 6.5,
    wholesalePrice: 4.5,
    costPrice: 2.6,
    currentStock: 8,
    minStock: 3,
    maxStock: 20,
    unit: "loaf",
    imageUrl: "/images/products/brioche.jpg",
    storeId: "STORE-001",
    createdAt: new Date("2024-02-01"),
    updatedAt: new Date("2024-10-08"),
  },
];

// Simple product items (for backward compatibility)
export const MOCK_PRODUCT_ITEMS: Item[] = MOCK_PRODUCTS.slice(0, 3).map((p) => ({
  id: p.id,
  name: p.name,
}));

// ============================================================================
// STOCK TRACKING
// ============================================================================

export const MOCK_STOCK_ROWS: StockRow[] = [
  { id: "1", product: "Butter AOP", currentStock: 45, minStock: 20, maxStock: 100, unit: "kg" },
  {
    id: "2",
    product: "Dark Chocolate 70%",
    currentStock: 50,
    minStock: 5,
    maxStock: 40,
    unit: "kg",
  },
  { id: "3", product: "Flour T55", currentStock: 250, minStock: 50, maxStock: 500, unit: "kg" },
  { id: "4", product: "Almonds", currentStock: 25, minStock: 10, maxStock: 50, unit: "kg" },
  { id: "5", product: "Sugar", currentStock: 23, minStock: 40, maxStock: 300, unit: "kg" },
  { id: "6", product: "Eggs", currentStock: 360, minStock: 120, maxStock: 600, unit: "units" },
  { id: "7", product: "Yeast", currentStock: 500, minStock: 1000, maxStock: 10000, unit: "g" },
  { id: "8", product: "Salt", currentStock: 60, minStock: 10, maxStock: 50, unit: "kg" },
];

// ============================================================================
// STOCK MOVEMENTS
// ============================================================================

export const MOCK_STOCK_MOVEMENTS: StockMovement[] = [
  {
    id: "MOV-001",
    materialId: "MAT-001",
    type: MovementType.IN,
    quantity: 50,
    unit: "kg",
    reason: "Purchase order received",
    notes: "Delivery from Grain & Co",
    referenceId: "PO-2024-1001",
    referenceType: "purchase_order",
    userId: "USER-001",
    userName: "Admin User",
    storeId: "STORE-001",
    createdAt: new Date("2024-10-25T10:30:00"),
  },
  {
    id: "MOV-002",
    materialId: "MAT-001",
    type: MovementType.OUT,
    quantity: 5,
    unit: "kg",
    reason: "Production",
    notes: "Used for Baguette Tradition batch #245",
    referenceId: "BATCH-245",
    referenceType: "production_batch",
    userId: "USER-002",
    userName: "Baker Jean",
    storeId: "STORE-001",
    createdAt: new Date("2024-10-26T08:15:00"),
  },
  {
    id: "MOV-003",
    materialId: "MAT-002",
    type: MovementType.IN,
    quantity: 25,
    unit: "kg",
    reason: "Purchase order received",
    notes: "Delivery from DairyFresh",
    referenceId: "PO-2024-1002",
    referenceType: "purchase_order",
    userId: "USER-001",
    userName: "Admin User",
    storeId: "STORE-001",
    createdAt: new Date("2024-10-27T11:00:00"),
  },
  {
    id: "MOV-004",
    materialId: "MAT-007",
    type: MovementType.WASTE,
    quantity: 0.5,
    unit: "kg",
    reason: "Damaged during storage",
    notes: "Found melted chocolate, improper temperature",
    userId: "USER-003",
    userName: "Manager Marie",
    storeId: "STORE-001",
    createdAt: new Date("2024-10-27T14:20:00"),
  },
  {
    id: "MOV-005",
    materialId: "MAT-006",
    type: MovementType.ADJUSTMENT,
    quantity: -12,
    unit: "units",
    reason: "Inventory correction",
    notes: "Physical count showed discrepancy",
    userId: "USER-001",
    userName: "Admin User",
    storeId: "STORE-001",
    createdAt: new Date("2024-10-28T09:00:00"),
  },
];

// ============================================================================
// PRODUCTION BATCHES
// ============================================================================

export const MOCK_PRODUCTION_BATCHES: ProductionBatch[] = [
  {
    id: "BATCH-001",
    batchNumber: "BT-2024-1028-001",
    recipeId: "REC-001",
    quantityPlanned: 30,
    quantityProduced: 29,
    unit: "units",
    status: ProductionStatus.COMPLETED,
    operatorId: "USER-002",
    operatorName: "Baker Jean",
    startedAt: new Date("2024-10-28T05:00:00"),
    completedAt: new Date("2024-10-28T09:15:00"),
    qualityScore: 9.2,
    qualityNotes: "Excellent quality, one unit slightly underbaked",
    costActual: 7.8,
    costEstimated: 8.0,
    storeId: "STORE-001",
    createdAt: new Date("2024-10-28T05:00:00"),
    updatedAt: new Date("2024-10-28T09:15:00"),
  },
  {
    id: "BATCH-002",
    batchNumber: "CR-2024-1028-001",
    recipeId: "REC-002",
    quantityPlanned: 24,
    quantityProduced: 24,
    unit: "units",
    status: ProductionStatus.COMPLETED,
    operatorId: "USER-002",
    operatorName: "Baker Jean",
    startedAt: new Date("2024-10-27T22:00:00"),
    completedAt: new Date("2024-10-28T06:30:00"),
    qualityScore: 9.5,
    qualityNotes: "Perfect lamination, excellent rise",
    costActual: 17.1,
    costEstimated: 17.0,
    storeId: "STORE-001",
    createdAt: new Date("2024-10-27T22:00:00"),
    updatedAt: new Date("2024-10-28T06:30:00"),
  },
  {
    id: "BATCH-003",
    batchNumber: "BT-2024-1028-002",
    recipeId: "REC-001",
    quantityPlanned: 30,
    quantityProduced: 0,
    unit: "units",
    status: ProductionStatus.IN_PROGRESS,
    operatorId: "USER-004",
    operatorName: "Baker Sophie",
    startedAt: new Date("2024-10-28T09:30:00"),
    storeId: "STORE-001",
    createdAt: new Date("2024-10-28T09:30:00"),
    updatedAt: new Date("2024-10-28T09:30:00"),
  },
  {
    id: "BATCH-004",
    batchNumber: "BR-2024-1028-001",
    recipeId: "REC-003",
    quantityPlanned: 4,
    quantityProduced: 0,
    unit: "loaves",
    status: ProductionStatus.PLANNED,
    storeId: "STORE-001",
    createdAt: new Date("2024-10-28T08:00:00"),
    updatedAt: new Date("2024-10-28T08:00:00"),
  },
];

// ============================================================================
// CHART DATA
// ============================================================================

export const MOCK_CHART_DATA: ChartDataPoint[] = [
  { date: "Mon", qty: 120 },
  { date: "Tue", qty: 180 },
  { date: "Wed", qty: 160 },
  { date: "Thu", qty: 220 },
  { date: "Fri", qty: 190 },
  { date: "Sat", qty: 240 },
  { date: "Sun", qty: 200 },
];
