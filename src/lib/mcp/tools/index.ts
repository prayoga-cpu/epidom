import type { McpTool } from "../define-tool";
import { getStoreProfile, listStores } from "./context";
import { getOrder, getSalesSummary, getTopItems, listOrders } from "./sales";
import {
  adjustStock,
  getStockAlerts,
  listInventory,
  listStockMovements,
  recordWaste,
} from "./inventory";
import {
  cancelSupplierOrder,
  createSupplierOrder,
  listSupplierOrders,
  listSuppliers,
  proposeSupplierOrder,
  receiveSupplierOrder,
} from "./suppliers";
import { createMenuItems, deleteMenuItem, getMenu, updateMenuItem } from "./menu";
import { importCatalog } from "./import";
import {
  createRosterEntries,
  getHoursAndOvertime,
  getPayroll,
  getRoster,
  publishRoster,
} from "./staff";
import { getCustomer, listCustomers, upsertCustomer } from "./customers";
import {
  getAllOutletsSummary,
  getSalesBreakdown,
  listExpensesTool,
  recordExpense,
} from "./finance";

/**
 * Every Claude connector tool, in the order Claude lists them. The full
 * catalog with the access rules is in docs/MCP.md; keep both in step.
 */
export const MCP_TOOLS: readonly McpTool[] = [
  // Context
  listStores,
  getStoreProfile,
  // Sales and finance
  getSalesSummary,
  getTopItems,
  getSalesBreakdown,
  getAllOutletsSummary,
  listOrders,
  getOrder,
  listExpensesTool,
  recordExpense,
  // Inventory
  getStockAlerts,
  listInventory,
  listStockMovements,
  adjustStock,
  recordWaste,
  // Suppliers
  listSuppliers,
  listSupplierOrders,
  proposeSupplierOrder,
  createSupplierOrder,
  receiveSupplierOrder,
  cancelSupplierOrder,
  // Menu
  getMenu,
  createMenuItems,
  updateMenuItem,
  deleteMenuItem,
  // Bulk import
  importCatalog,
  // Staff
  getRoster,
  getHoursAndOvertime,
  getPayroll,
  createRosterEntries,
  publishRoster,
  // Customers
  listCustomers,
  getCustomer,
  upsertCustomer,
];
