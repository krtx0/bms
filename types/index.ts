export interface User {
  email: string;
  full_name: string;
  role: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  created_at: string;
}

// Ingredients and packaging are identical shapes on the backend.
export interface MaterialItem {
  id: string;
  name: string;
  unit: string;
  current_cost_per_unit: number;
  reorder_threshold: number;
  category: string;
  supplier_id: string | null;
  created_at: string;
}
export type Ingredient = MaterialItem;
export type Packaging = MaterialItem;

export interface IngredientLine {
  ingredient_id: string;
  qty_per_unit: number;
}

export interface Component {
  id: string;
  name: string;
  unit: string;
  ingredient_list: IngredientLine[];
  reorder_threshold: number;
  created_at: string;
}

export interface CostBreakdownLine {
  ingredient_id: string;
  name: string;
  qty_per_unit: number;
  unit_cost: number;
  line_cost: number;
}

export interface ComponentCost {
  unit_cost: number;
  breakdown: CostBreakdownLine[];
}

export interface ComponentLine {
  component_id: string;
  qty_per_unit: number;
}

export interface Recipe {
  id: string;
  flavour_code: string;
  name: string;
  base_cake_price: number;
  base_ingredients: IngredientLine[];
  components: ComponentLine[];
  created_at: string;
}

export interface RecipeComponentBreakdownLine {
  component_id: string;
  name: string;
  qty_per_unit: number;
  unit_cost: number;
  line_cost: number;
}

export interface RecipeCost {
  cake_cost: number;
  component_cost: number;
  total_product_cost: number;
  base_cake_price: number;
  profit_margin_pct: number;
  ingredient_breakdown: CostBreakdownLine[];
  component_breakdown: RecipeComponentBreakdownLine[];
}

// ---- Phase 3: inventory & purchases ----

export type ItemType = 'ingredient' | 'packaging' | 'semi_finished';

export interface InventoryBatch {
  id: string;
  item_type: ItemType;
  item_id: string;
  quantity_received: number;
  remaining_qty: number;
  unit_cost: number;
  received_date: string;
  source_type: 'purchase' | 'adjustment';
  source_id: string | null;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  item_type: ItemType;
  item_id: string;
  batch_id: string;
  quantity_delta: number;
  reason: 'purchase_received' | 'manual_adjustment' | 'order_production';
  reference_id: string | null;
  created_at: string;
}

export interface StockLevel {
  item_type: ItemType;
  item_id: string;
  name: string;
  unit: string;
  current_stock: number;
  reorder_threshold: number;
  is_low_stock: boolean;
}

export interface PurchaseLineItem {
  item_type: 'ingredient' | 'packaging';
  item_id: string;
  quantity: number;
  unit_cost: number;
}

export interface Purchase {
  id: string;
  purchase_number: string;
  supplier_id: string | null;
  purchase_date: string;
  line_items: PurchaseLineItem[];
  total_cost: number;
  notes: string;
  created_at: string;
}

// ---- Phase 4: customers, orders, payments & invoices ----

export interface ImportantDate {
  label: string;
  date: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  is_lead: boolean;
  important_dates: ImportantDate[];
  created_at: string;
}

export type OrderStatus = 'Pending' | 'Confirmed' | 'Production' | 'Ready' | 'Delivered' | 'Cancelled';
export type PaymentStatus = 'Pending' | 'Partially Paid' | 'Fully Paid';
export type OrderPriority = 'low' | 'medium' | 'high';

// POST /api/orders line item input — a subset of OrderLineItem below; the server fills in the
// rest (flavour_code snapshot + every cost/profit figure) from the recipe at creation time.
export interface OrderLineItemInput {
  recipe_id: string;
  weight: number;
  quantity: number;
  customizations?: string;
  selling_price: number; // PER UNIT rate — matches recipe.base_cake_price, NOT a line total
}

export interface OrderLineItem {
  recipe_id: string;
  flavour_code: string;
  weight: number;
  quantity: number;
  customizations: string;
  base_cake_price: number; // per unit
  cake_cost: number; // per unit
  component_cost: number; // per unit
  total_product_cost: number; // per unit
  customization_cost: number; // per unit
  selling_price: number; // per unit — the Rate
  estimated_profit: number; // per unit
  line_total_amount: number; // = selling_price * quantity — the Amount
  line_total_cost: number; // = total_product_cost * quantity
}

export interface OrderStatusHistoryEntry {
  status: string;
  changed_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  event_date: string;
  delivery_date: string;
  status: OrderStatus;
  status_history: OrderStatusHistoryEntry[];
  priority: OrderPriority;
  source: 'public_form' | 'admin' | 'sol_bombay';
  line_items: OrderLineItem[];
  selling_price: number; // order total Amount = sum(line_total_amount)
  total_product_cost: number;
  estimated_profit: number;
  payment_status: PaymentStatus;
  amount_paid: number;
  notes: string;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
  method: string;
  notes: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  customer_id: string;
  issued_date: string;
  amount: number;
  created_at: string;
}

// PATCH /api/orders/{id}/status's `shortfall` field. Only populated (as {shortfalls: [...]}) the
// first time an order transitions into "Production"; every other transition returns `{}` (no
// `shortfalls` key at all).
export interface ProductionShortfallItem {
  ingredient_id: string;
  name: string;
  unit: string;
  shortfall_qty: number;
}

// ---- Phase 5: dashboard & reports ----

export interface DashboardRecentOrder {
  order_number: string;
  customer_name: string;
  selling_price: number;
  status: OrderStatus;
  created_at: string;
}

export interface DashboardRecentPurchase {
  purchase_number: string;
  supplier_name: string | null;
  total_cost: number;
  purchase_date: string;
}

export interface RevenueCostMonth {
  month: string; // "2026-08"
  revenue: number;
  cost: number;
}

export interface TodayBoardOrderRef {
  order_number: string;
  customer_name: string | null;
}

export interface TodayBoardLowStockItem {
  name: string;
  unit: string;
  current_stock: number;
  reorder_threshold: number;
}

export interface TodayBoardBatchReady {
  item_name: string;
  quantity: number;
  unit: string;
  used_in_orders: number;
}

export interface TodayBoard {
  pending_confirmation: { count: number; orders: TodayBoardOrderRef[] };
  deliveries_today: { count: number; orders: TodayBoardOrderRef[] };
  low_stock: TodayBoardLowStockItem[];
  batch_ready: TodayBoardBatchReady | null;
}

export type NotificationType = 'birthday' | 'low_stock' | 'pending_confirmation' | 'delivery_soon';

export interface NotificationItem {
  key: string;
  type: NotificationType;
  title: string;
  subtitle: string;
  completed: boolean;
}

export interface DashboardSummary {
  orders_today: number;
  orders_yesterday: number;
  pending_orders: number;
  completed_orders_this_month: number;
  completed_orders_last_month: number;
  revenue_today: number;
  revenue_yesterday: number;
  revenue_this_month: number;
  revenue_last_month: number;
  profit_this_month: number;
  outstanding_payments: number;
  low_stock_count: number;
  upcoming_deliveries_7d: number;
  recent_orders: DashboardRecentOrder[];
  recent_purchases: DashboardRecentPurchase[];
  revenue_cost_trend: RevenueCostMonth[];
  today_board: TodayBoard;
}

export interface CashFlowMonth {
  month: string; // "2026-08"
  revenue: number;
  expenses: number;
}

export interface FinancialReport {
  revenue: number;
  cogs: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
  cash_flow: CashFlowMonth[];
}

export interface MonthlySales {
  month: string;
  revenue: number;
  order_count: number;
}

export interface BestSellingFlavour {
  flavour_code: string;
  name: string;
  units_sold: number;
  revenue: number;
}

export interface TopCustomer {
  customer_id: string;
  name: string;
  total_spent: number;
  order_count: number;
}

export interface SalesReport {
  monthly_sales: MonthlySales[];
  best_selling_flavours: BestSellingFlavour[]; // top 10, by units_sold
  top_customers: TopCustomer[]; // top 10, by total_spent
}

export interface ProductCostAnalysis {
  flavour_code: string;
  name: string;
  avg_product_cost: number;
  units_sold: number;
}

export interface PurchaseCategoryTotal {
  category: string;
  total: number;
}

// inventory_summary.items is the same shape as StockLevel (routers/reports.py reuses
// routers/inventory.py's get_stock_levels), pre-filtered to only the low-stock rows.
export interface OperationalReport {
  product_cost_analysis: ProductCostAnalysis[];
  inventory_summary: { low_stock_count: number; items: StockLevel[] };
  purchase_summary: { total_spend: number; purchase_count: number; by_category: PurchaseCategoryTotal[] };
}

export interface Expense {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  notes: string;
  created_at: string;
}

// ---- Phase 6: settings ----

export interface BusinessInfo {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
}

export interface Workspace {
  currency: string;
  timezone: string;
}

export interface Settings {
  business_info: BusinessInfo;
  workspace: Workspace;
}
