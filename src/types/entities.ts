/**
 * Comprehensive type definitions for all entities
 * These types align with Prisma schema and serve as DTOs for API requests/responses
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum MaterialCategory {
  RAW_MATERIALS = "raw_materials",
  PACKAGING = "packaging",
  DAIRY = "dairy",
  GRAINS = "grains",
  SPICES = "spices",
  OTHER = "other",
}

export enum ProductionStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  QUALITY_CHECK = "quality_check",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum OrderStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  IN_STOCK = "in_stock",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
}

export enum PaymentStatus {
  PENDING = "pending",
  PAID = "paid",
  PARTIAL = "partial",
  OVERDUE = "overdue",
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
}

export enum MovementType {
  IN = "in",
  OUT = "out",
  ADJUSTMENT = "adjustment",
  PRODUCTION = "production",
  WASTE = "waste",
  RETURN = "return",
}

export enum AlertType {
  LOW_STOCK = "low_stock",
  EXPIRY_WARNING = "expiry_warning",
  QUALITY_ISSUE = "quality_issue",
  SUPPLIER_DELAY = "supplier_delay",
  OVERSTOCK = "overstock",
}

export enum AlertPriority {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

export enum AlertStatus {
  ACTIVE = "active",
  RESOLVED = "resolved",
  SNOOZED = "snoozed",
}

export enum UserRole {
  OWNER = "owner",
  ADMIN = "admin",
  MANAGER = "manager",
  OPERATOR = "operator",
  VIEWER = "viewer",
}

export enum PaymentTerms {
  COD = "cod",
  NET15 = "net15",
  NET30 = "net30",
  NET60 = "net60",
  NET90 = "net90",
  PREPAID = "prepaid",
}

export enum DeliveryType {
  INCOMING = "incoming",
  OUTGOING = "outgoing",
}

export enum SupplierDeliveryStatus {
  PENDING = "pending",
  IN_TRANSIT = "in_transit",
  RECEIVED = "received",
  CANCELLED = "cancelled",
}

// ============================================================================
// CORE ENTITIES
// ============================================================================

export interface MaterialSupplier {
  id: string;
  materialId: string;
  supplierId: string;
  price: number;
  isPreferred: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  supplier: {
    id: string;
    name: string;
  };
}

export interface Material {
  id: string;
  name: string;
  sku: string;
  category?: string | null;
  description?: string | null;
  unit: string;
  unitCost: number;
  currentStock: number;
  minStock: number;
  maxStock: number;
  isActive: boolean;
  storeId: string;
  ingredientSuppliers: MaterialSupplier[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string | "";
  category: string | "";
  yieldQuantity: number;
  yieldUnit: string;
  productionTimeMinutes: number;
  instructions: string | "";
  costPerUnit: number | 0;
  costPerBatch: number | 0;
  storeId: string;
  ingredients: RecipeIngredient[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  materialId: string;
  material?: Material;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  recipeId?: string;
  recipe?: Recipe;
  category?: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  retailPrice: number;
  wholesalePrice?: number;
  costPrice: number;
  unit: string;
  imageUrl?: string;
  barcode?: string;
  storeId: string;
  variants?: ProductVariant[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  retailPrice: number;
  wholesalePrice?: number;
  attributes: Record<string, string>; // e.g., { size: "large", flavor: "chocolate" }
  priceAdjustment?: number;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  paymentTerms?: PaymentTerms;
  deliverySchedule?: string;
  rating?: number;
  notes?: string;
  storeId: string;
  materials?: Material[];
  onTimeDeliveryRate?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierDelivery {
  id: string;
  deliveryReference: string;
  supplierId: string;
  supplier?: Supplier;
  deliveryType: DeliveryType;
  status: SupplierDeliveryStatus;
  expectedDate: Date;
  receivedDate?: Date;
  notes?: string;
  storeId: string;
  items: SupplierDeliveryItem[];
  statusHistory?: SupplierDeliveryStatusHistory[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierDeliveryItem {
  id: string;
  deliveryId: string;
  materialId: string;
  material?: Material;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface SupplierDeliveryStatusHistory {
  id: string;
  deliveryId: string;
  status: SupplierDeliveryStatus;
  notes?: string;
  userId?: string;
  userName?: string;
  createdAt: Date;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryDate?: Date;
  dueDate?: Date;
  status: OrderStatus;
  totalAmount?: number;
  subtotal: number;
  orderDate: Date;
  deliveryPostalCode: string;
  deliveryCountry: string;
  supplierId: string;
  supplier: Supplier;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  storeId: string;
  items: OrderItem[];
  statusHistory?: OrderStatusHistory[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product?: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  notes?: string;
  userId?: string;
  userName?: string;
  createdAt: Date;
}

export interface ProductionBatch {
  id: string;
  batchNumber: string;
  recipeId: string;
  recipe?: Recipe;
  quantityPlanned: number;
  quantityProduced: number;
  unit: string;
  status: ProductionStatus;
  operatorId?: string;
  operatorName?: string;
  startedAt?: Date;
  completedAt?: Date;
  qualityScore?: number;
  qualityNotes?: string;
  costActual?: number;
  costEstimated?: number;
  storeId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockMovement {
  id: string;
  materialId?: string;
  productId?: string;
  material?: Material;
  product?: Product;
  type: MovementType;
  quantity: number;
  unit: string;
  reason?: string;
  notes?: string;
  referenceId?: string; // Order ID, Batch ID, etc.
  referenceType?: string;
  userId?: string;
  userName?: string;
  storeId: string;
  createdAt: Date;
}

export interface Alert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  status: AlertStatus;
  title: string;
  message: string;
  materialId?: string;
  productId?: string;
  supplierId?: string;
  material?: Material;
  product?: Product;
  supplier?: Supplier;
  metadata?: Record<string, any>;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  snoozedUntil?: Date;
  storeId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  imageUrl?: string;
  role: UserRole;
  locale: string;
  timezone: string;
  currency: string;
  businessId?: string;
  permissions?: string[];
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  userId: string;
  user?: User;
  storeId: string;
  role: UserRole;
  permissions?: string[];
  invitedBy?: string;
  invitedAt?: Date;
  acceptedAt?: Date;
}

// ============================================================================
// API REQUEST/RESPONSE DTOs
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Material DTOs
export interface CreateMaterialDto {
  name: string;
  sku: string;
  category?: string;
  description?: string;
  unit: string;
  unitCost: number;
  currentStock?: number;
  minStock?: number;
  maxStock?: number;
  suppliers?: Array<{
    supplierId: string;
    price: number;
    isPreferred?: boolean;
  }>;
}

export interface UpdateMaterialDto extends Partial<CreateMaterialDto> {}

export interface MaterialFilters extends PaginationParams {
  search?: string;
  category?: string;
  supplierId?: string;
  stockStatus?: "in_stock" | "low_stock" | "out_of_stock" | "overstocked";
}

// Recipe DTOs
export interface CreateRecipeDto {
  name: string;
  description?: string;
  category?: string;
  yieldQuantity: number;
  yieldUnit: string;
  productionTimeMinutes: number;
  instructions?: string;
  ingredients: {
    materialId: string;
    quantity: number;
    unit: string;
    notes?: string;
  }[];
}

export interface UpdateRecipeDto extends Partial<CreateRecipeDto> {}

export interface RecipeFilters extends PaginationParams {
  search?: string;
  category?: string;
}

// Product DTOs
export interface CreateProductDto {
  name: string;
  sku?: string;
  description?: string;
  recipeId?: string;
  category?: string;
  retailPrice: number;
  wholesalePrice?: number;
  costPrice: number;
  unit: string;
  imageUrl?: string;
  variants?: Omit<ProductVariant, "id" | "productId">[];
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

export interface ProductFilters extends PaginationParams {
  search?: string;
  category?: string;
  hasRecipe?: boolean;
}

// Supplier DTOs
export interface CreateSupplierDto {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  paymentTerms?: PaymentTerms;
  deliverySchedule?: string;
  notes?: string;
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> {
  rating?: number;
}

export interface SupplierFilters extends PaginationParams {
  search?: string;
  city?: string;
  country?: string;
  rating?: number;
}

// Order DTOs
export interface CreateOrderDto {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryDate?: Date;
  dueDate?: Date;
  notes?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }[];
}

export interface UpdateOrderDto extends Partial<CreateOrderDto> {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
}

export interface OrderFilters extends PaginationParams {
  search?: string;
  status?: OrderStatus | OrderStatus[];
  paymentStatus?: PaymentStatus | PaymentStatus[];
  dateFrom?: Date;
  dateTo?: Date;
}

// Stock DTOs
export interface StockAdjustmentDto {
  materialId?: string;
  productId?: string;
  type: MovementType;
  quantity: number;
  reason?: string;
  notes?: string;
}

export interface StockFilters extends PaginationParams {
  search?: string;
  type?: "material" | "product";
  category?: string;
  stockStatus?: "critical" | "low" | "ok" | "excess";
}

// Production DTOs
export interface CreateProductionBatchDto {
  recipeId: string;
  quantityPlanned: number;
  operatorId?: string;
  operatorName?: string;
}

export interface UpdateProductionBatchDto {
  status?: ProductionStatus;
  quantityProduced?: number;
  qualityScore?: number;
  qualityNotes?: string;
}

export interface ProductionFilters extends PaginationParams {
  search?: string;
  status?: ProductionStatus | ProductionStatus[];
  recipeId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// Alert DTOs
export interface CreateAlertDto {
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  materialId?: string;
  productId?: string;
  supplierId?: string;
  metadata?: Record<string, any>;
}

export interface ResolveAlertDto {
  resolutionNotes?: string;
}

export interface AlertFilters extends PaginationParams {
  type?: AlertType | AlertType[];
  priority?: AlertPriority | AlertPriority[];
  status?: AlertStatus | AlertStatus[];
  dateFrom?: Date;
  dateTo?: Date;
}

// Analytics DTOs
export interface DashboardStats {
  stockUtilization: number;
  totalOpenOrders: number;
  activeRecipes: number;
  lowStockItems: number;
  criticalAlerts: number;
  productionBatchesInProgress: number;
  revenueToday: number;
  revenueThisMonth: number;
}

export interface ProductionHistoryData {
  date: string;
  quantity: number;
  revenue?: number;
}

export interface WorkflowStats {
  inStock: number;
  processing: number;
  delivered: number;
}

// Bulk Operation DTOs
export interface BulkOperationResult {
  success: number;
  failed: number;
  errors?: Array<{
    id: string;
    error: string;
  }>;
}

// Export DTOs
export interface ExportParams {
  format: "csv" | "excel" | "pdf";
  filters?: any;
  columns?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
}
