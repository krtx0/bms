import type { IconName } from '../Icon';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  // Opens in a new tab. Needed for /order-form specifically — it's a public page outside the
  // authenticated app shell (no sidebar there), so navigating to it in-place would strand the
  // admin with no way back except the browser's back button.
  external?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/orders', label: 'Orders', icon: 'orders' },
  { to: '/order-form', label: 'Customer Order Form', icon: 'orderForm', external: true },
  { to: '/customers', label: 'Customer Form', icon: 'customers' },
  { to: '/future-leads', label: 'Future Leads', icon: 'leads' },
  { to: '/recipes', label: 'Recipes & Components', icon: 'recipes' },
  { to: '/inventory', label: 'Inventory', icon: 'inventory' },
  { to: '/packaging', label: 'Packaging Inventory', icon: 'packaging' },
  { to: '/semi-finished', label: 'Semi-Finished', icon: 'semiFinished' },
  { to: '/suppliers', label: 'Suppliers', icon: 'suppliers' },
  { to: '/purchases', label: 'Purchases', icon: 'purchases' },
  { to: '/costing', label: 'Costing & Pricing', icon: 'costing' },
  { to: '/invoices', label: 'Invoices', icon: 'invoices' },
  { to: '/profit', label: 'Profit Dashboard', icon: 'profit' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];
