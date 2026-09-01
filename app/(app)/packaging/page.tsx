import { MaterialPage } from '@/components/MaterialPage';

export default function PackagingPage() {
  // Phase 3: adds live stock levels, low-stock highlighting, and a manual stock-adjustment
  // action on top of Phase 2's packaging master-data CRUD (ported from
  // frontend/src/pages/production/PackagingPage.tsx).
  return (
    <MaterialPage
      apiPath="/api/packaging"
      itemType="packaging"
      title="Packaging Inventory"
      subtitle="Packaging SKUs tracked"
      itemLabel="packaging item"
    />
  );
}
