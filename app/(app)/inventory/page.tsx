import { MaterialPage } from '@/components/MaterialPage';

export default function InventoryPage() {
  // Phase 3: adds live stock levels, low-stock highlighting, and a manual stock-adjustment
  // action on top of Phase 2's ingredient master-data CRUD (ported from
  // frontend/src/pages/production/InventoryPage.tsx).
  return (
    <MaterialPage apiPath="/api/ingredients" itemType="ingredient" title="Inventory" subtitle="Ingredient stock levels" itemLabel="ingredient" />
  );
}
