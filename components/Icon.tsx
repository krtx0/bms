export type IconName =
  | 'dashboard'
  | 'orders'
  | 'customers'
  | 'leads'
  | 'recipes'
  | 'inventory'
  | 'packaging'
  | 'semiFinished'
  | 'purchases'
  | 'costing'
  | 'invoices'
  | 'profit'
  | 'settings'
  | 'search'
  | 'bell'
  | 'chevronLeft'
  | 'plus'
  | 'edit'
  | 'suppliers'
  | 'menu'
  | 'orderForm';

const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  orders: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 3v3h8V3" />
      <path d="M8 11h8M8 15h5" />
    </>
  ),
  customers: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5" />
    </>
  ),
  leads: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <path d="M16 4.5c1.7.3 3 1.8 3 3.5s-1.3 3.2-3 3.5M21 21c0-3-2-5.3-4.5-6" />
    </>
  ),
  recipes: (
    <>
      <path d="M4 4.5C4 3.7 4.7 3 5.5 3H12v18H5.5c-.8 0-1.5-.7-1.5-1.5v-15Z" />
      <path d="M20 4.5c0-.8-.7-1.5-1.5-1.5H12v18h6.5c.8 0 1.5-.7 1.5-1.5v-15Z" />
    </>
  ),
  inventory: (
    <>
      <path d="M3 8l9-5 9 5-9 5-9-5Z" />
      <path d="M3 8v9l9 5 9-5V8" />
      <path d="M12 13v9" />
    </>
  ),
  packaging: (
    <>
      <rect x="4" y="7" width="16" height="13" rx="1.5" />
      <path d="M4 11h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
    </>
  ),
  semiFinished: (
    <>
      <path d="M12 3l8 4.5-8 4.5-8-4.5L12 3Z" />
      <path d="M4 12l8 4.5 8-4.5M4 16.5L12 21l8-4.5" />
    </>
  ),
  purchases: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2.5 3h2.5l2.4 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7H6" />
    </>
  ),
  costing: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2" />
      <path d="M8 7.5h8M8 11h2.2M12.8 11H15M8 14.5h2.2M12.8 14.5H15M8 18h2.2M12.8 18H15" />
    </>
  ),
  invoices: (
    <>
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M15 3v4h4M8.5 12h7M8.5 15.5h7M8.5 8.5h3" />
    </>
  ),
  profit: (
    <>
      <path d="M4 18l5.5-6 4 3.5L21 7" />
      <path d="M15.5 7H21v5.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.4-2-3.5-2.3.8a7.7 7.7 0 0 0-2.6-1.5L14 2h-4l-.5 2.4a7.7 7.7 0 0 0-2.6 1.5l-2.3-.8-2 3.5 2 1.4a7.6 7.6 0 0 0 0 3l-2 1.4 2 3.5 2.3-.8c.75.66 1.63 1.17 2.6 1.5L10 22h4l.5-2.4a7.7 7.7 0 0 0 2.6-1.5l2.3.8 2-3.5-2-1.4Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 4.5 1.5 6 1.5 6h-15S6 13.5 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  chevronLeft: <path d="M14.5 4.5L7 12l7.5 7.5" />,
  plus: <path d="M12 4.5v15M4.5 12h15" />,
  edit: (
    <>
      <path d="M4 20.5h4L18.5 10a2.1 2.1 0 0 0 0-3l-1.5-1.5a2.1 2.1 0 0 0-3 0L4 15v5.5Z" />
      <path d="M12.5 7L17 11.5" />
    </>
  ),
  suppliers: (
    <>
      <rect x="2.5" y="7" width="10" height="9" rx="1" />
      <path d="M12.5 10h3.5l3.5 3v3h-2" />
      <path d="M2.5 16h1M9 16h4.5" />
      <circle cx="7" cy="18.5" r="1.6" />
      <circle cx="16.5" cy="18.5" r="1.6" />
    </>
  ),
  menu: <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />,
  orderForm: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8" />
      <path d="M8 13.5l2.5 2.5L16 10.5" />
    </>
  ),
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
