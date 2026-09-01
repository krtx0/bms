'use client';

import { useEffect, useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/DataTable';
import { FormModal, FormField } from '@/components/FormModal';
import { LineItemsEditor, type LineItem } from '@/components/LineItemsEditor';
import { useApiResource } from '@/hooks/useApiResource';
import { useRecipesWithCost } from '@/hooks/useRecipeCosts';
import { api, ApiError } from '@/lib/apiClient';
import { formatCurrency } from '@/lib/currency';
import type { Component, ComponentCost, Ingredient, Recipe, RecipeCost } from '@/types';

export default function RecipesPage() {
  const [tab, setTab] = useState<'flavours' | 'components'>('flavours');
  const { data: ingredients } = useApiResource<Ingredient[]>('/api/ingredients');
  const { data: components, loading: componentsLoading, error: componentsError, reload: reloadComponents } =
    useApiResource<Component[]>('/api/components');
  const { recipes, costs, loading: recipesLoading, error: recipesError, reload: reloadRecipes } = useRecipesWithCost();

  const [componentCosts, setComponentCosts] = useState<Record<string, ComponentCost>>({});
  useEffect(() => {
    if (!components || components.length === 0) {
      setComponentCosts({});
      return;
    }
    Promise.all(
      components.map((c) => api.get<ComponentCost>(`/api/components/${c.id}/cost`).then((cost) => [c.id, cost] as const))
    ).then((pairs) => setComponentCosts(Object.fromEntries(pairs)));
  }, [components]);

  return (
    <>
      <Topbar title="Recipes & Components" subtitle="Flavours, components and costing" />
      <div className="page-content">
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button className={tab === 'flavours' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('flavours')}>
            Flavours
          </button>
          <button className={tab === 'components' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('components')}>
            Components
          </button>
        </div>

        {tab === 'flavours' ? (
          <FlavoursTab
            recipes={recipes ?? []}
            costs={costs}
            ingredients={ingredients ?? []}
            components={components ?? []}
            loading={recipesLoading}
            error={recipesError}
            reload={reloadRecipes}
          />
        ) : (
          <ComponentsTab
            components={components ?? []}
            costs={componentCosts}
            ingredients={ingredients ?? []}
            loading={componentsLoading}
            error={componentsError}
            reload={reloadComponents}
          />
        )}
      </div>
    </>
  );
}

// ---- shared read-only breakdown table (ingredient/component cost lines) ----

interface BreakdownRow {
  name: string;
  qty_per_unit: number;
  unit_cost: number;
  line_cost: number;
}

function BreakdownTable({ rows }: { rows: BreakdownRow[] }) {
  if (rows.length === 0) return null;
  return (
    <table style={{ width: '100%', fontSize: 12.5, marginBottom: 10, borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ color: 'var(--color-text-secondary)' }}>
          <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
          <th style={{ textAlign: 'right', padding: '4px 0' }}>Qty</th>
          <th style={{ textAlign: 'right', padding: '4px 0' }}>Unit cost</th>
          <th style={{ textAlign: 'right', padding: '4px 0' }}>Line cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ padding: '3px 0' }}>{r.name}</td>
            <td style={{ textAlign: 'right' }}>{r.qty_per_unit}</td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(r.unit_cost)}</td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(r.line_cost)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ------------------------------- Flavours tab -------------------------------

interface RecipeFormState {
  flavour_code: string;
  name: string;
  base_cake_price: number;
  baseIngredients: LineItem[];
  componentsUsed: LineItem[];
}

const EMPTY_RECIPE_FORM: RecipeFormState = {
  flavour_code: '',
  name: '',
  base_cake_price: 0,
  baseIngredients: [],
  componentsUsed: [],
};

function FlavoursTab({
  recipes,
  costs,
  ingredients,
  components,
  loading,
  error: loadError,
  reload,
}: {
  recipes: Recipe[];
  costs: Record<string, RecipeCost>;
  ingredients: Ingredient[];
  components: Component[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [form, setForm] = useState<RecipeFormState>(EMPTY_RECIPE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const ingredientOptions = ingredients.map((i) => ({ id: i.id, name: `${i.name} (${i.unit})` }));
  const componentOptions = components.map((c) => ({ id: c.id, name: `${c.name} (${c.unit})` }));

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_RECIPE_FORM);
    setError('');
    setOpen(true);
  }

  function openEdit(recipe: Recipe) {
    setEditing(recipe);
    setForm({
      flavour_code: recipe.flavour_code,
      name: recipe.name,
      base_cake_price: recipe.base_cake_price,
      baseIngredients: recipe.base_ingredients.map((li) => ({ id: li.ingredient_id, qty_per_unit: li.qty_per_unit })),
      componentsUsed: recipe.components.map((li) => ({ id: li.component_id, qty_per_unit: li.qty_per_unit })),
    });
    setError('');
    setOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        flavour_code: form.flavour_code,
        name: form.name,
        base_cake_price: form.base_cake_price,
        base_ingredients: form.baseIngredients.filter((li) => li.id).map((li) => ({ ingredient_id: li.id, qty_per_unit: li.qty_per_unit })),
        components: form.componentsUsed.filter((li) => li.id).map((li) => ({ component_id: li.id, qty_per_unit: li.qty_per_unit })),
      };
      if (editing) await api.patch(`/api/recipes/${editing.id}`, payload);
      else await api.post('/api/recipes', payload);
      setOpen(false);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setSubmitting(true);
    setError('');
    try {
      await api.delete(`/api/recipes/${editing.id}`);
      setOpen(false);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const editingCost = editing ? costs[editing.id] : undefined;

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={openCreate}>
          + New flavour
        </button>
      </div>

      {loading && recipes.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          Loading…
        </div>
      ) : loadError ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-red-text)' }}>
          {loadError}
        </div>
      ) : (
        <DataTable
          rows={recipes}
          keyField="id"
          searchPlaceholder="Search flavours…"
          emptyMessage="No flavours yet."
          onRowClick={openEdit}
          columns={[
            { key: 'flavour_code', header: 'Code' },
            { key: 'name', header: 'Name' },
            { key: 'base_cake_price', header: 'Sell Price', align: 'right', render: (r) => formatCurrency(r.base_cake_price) },
            {
              key: 'total_product_cost',
              header: 'Cost',
              align: 'right',
              render: (r) => (costs[r.id] ? formatCurrency(costs[r.id].total_product_cost) : '…'),
            },
            {
              key: 'profit_margin_pct',
              header: 'Margin',
              align: 'right',
              render: (r) => (costs[r.id] ? `${costs[r.id].profit_margin_pct.toFixed(1)}%` : '…'),
            },
          ]}
        />
      )}

      <FormModal
        open={open}
        title={editing ? `Edit ${editing.name}` : 'New flavour'}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
      >
        {editingCost && (
          <div className="card" style={{ padding: 14, marginBottom: 18, background: 'var(--color-bg-page)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, marginBottom: 10 }}>
              <span>
                Cake cost: <strong>{formatCurrency(editingCost.cake_cost)}</strong>
              </span>
              <span>
                Component cost: <strong>{formatCurrency(editingCost.component_cost)}</strong>
              </span>
              <span>
                Total cost: <strong>{formatCurrency(editingCost.total_product_cost)}</strong>
              </span>
              <span>
                Margin: <strong>{editingCost.profit_margin_pct.toFixed(1)}%</strong>
              </span>
            </div>
            <BreakdownTable rows={editingCost.ingredient_breakdown} />
            <BreakdownTable rows={editingCost.component_breakdown} />
          </div>
        )}

        <FormField label="Flavour code">
          <input
            value={form.flavour_code}
            onChange={(e) => setForm({ ...form, flavour_code: e.target.value })}
            required
            style={{ width: '100%' }}
          />
        </FormField>
        <FormField label="Name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ width: '100%' }} />
        </FormField>
        <FormField label="Base cake price (₹)">
          <input
            type="number"
            min={0}
            step="any"
            value={form.base_cake_price}
            onChange={(e) => setForm({ ...form, base_cake_price: Number(e.target.value) || 0 })}
            required
            style={{ width: '100%' }}
          />
        </FormField>

        <LineItemsEditor
          label="Direct ingredients"
          items={form.baseIngredients}
          options={ingredientOptions}
          onChange={(baseIngredients) => setForm({ ...form, baseIngredients })}
        />
        <LineItemsEditor
          label="Components used"
          items={form.componentsUsed}
          options={componentOptions}
          onChange={(componentsUsed) => setForm({ ...form, componentsUsed })}
        />

        {error && <p style={{ color: 'var(--color-red-text)', fontSize: 13 }}>{error}</p>}

        {editing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            style={{ background: 'none', border: 'none', color: 'var(--color-red-text)', fontSize: 13, padding: 0, marginTop: 4 }}
          >
            Delete flavour
          </button>
        )}
      </FormModal>
    </>
  );
}

// ------------------------------ Components tab ------------------------------

interface ComponentFormState {
  name: string;
  unit: string;
  reorder_threshold: number;
  ingredientLines: LineItem[];
}

const EMPTY_COMPONENT_FORM: ComponentFormState = { name: '', unit: '', reorder_threshold: 0, ingredientLines: [] };

function ComponentsTab({
  components,
  costs,
  ingredients,
  loading,
  error: loadError,
  reload,
}: {
  components: Component[];
  costs: Record<string, ComponentCost>;
  ingredients: Ingredient[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Component | null>(null);
  const [form, setForm] = useState<ComponentFormState>(EMPTY_COMPONENT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const ingredientOptions = ingredients.map((i) => ({ id: i.id, name: `${i.name} (${i.unit})` }));

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_COMPONENT_FORM);
    setError('');
    setOpen(true);
  }

  function openEdit(component: Component) {
    setEditing(component);
    setForm({
      name: component.name,
      unit: component.unit,
      reorder_threshold: component.reorder_threshold,
      ingredientLines: component.ingredient_list.map((li) => ({ id: li.ingredient_id, qty_per_unit: li.qty_per_unit })),
    });
    setError('');
    setOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        unit: form.unit,
        reorder_threshold: form.reorder_threshold,
        ingredient_list: form.ingredientLines.filter((li) => li.id).map((li) => ({ ingredient_id: li.id, qty_per_unit: li.qty_per_unit })),
      };
      if (editing) await api.patch(`/api/components/${editing.id}`, payload);
      else await api.post('/api/components', payload);
      setOpen(false);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setSubmitting(true);
    setError('');
    try {
      await api.delete(`/api/components/${editing.id}`);
      setOpen(false);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const editingCost = editing ? costs[editing.id] : undefined;

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={openCreate}>
          + New component
        </button>
      </div>

      {loading && components.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          Loading…
        </div>
      ) : loadError ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-red-text)' }}>
          {loadError}
        </div>
      ) : (
        <DataTable
          rows={components}
          keyField="id"
          searchPlaceholder="Search components…"
          emptyMessage="No components yet."
          onRowClick={openEdit}
          columns={[
            { key: 'name', header: 'Name' },
            { key: 'unit', header: 'Unit' },
            {
              key: 'unit_cost',
              header: 'Unit Cost',
              align: 'right',
              render: (r) => (costs[r.id] ? formatCurrency(costs[r.id].unit_cost) : '…'),
            },
          ]}
        />
      )}

      <FormModal
        open={open}
        title={editing ? `Edit ${editing.name}` : 'New component'}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
      >
        {editingCost && (
          <div className="card" style={{ padding: 14, marginBottom: 18, background: 'var(--color-bg-page)' }}>
            <div style={{ fontSize: 13, marginBottom: 10 }}>
              Unit cost: <strong>{formatCurrency(editingCost.unit_cost)}</strong>
            </div>
            <BreakdownTable rows={editingCost.breakdown} />
          </div>
        )}

        <FormField label="Name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ width: '100%' }} />
        </FormField>
        <FormField label="Unit">
          <input
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            required
            placeholder="kg, litre, piece…"
            style={{ width: '100%' }}
          />
        </FormField>
        <FormField label="Reorder threshold">
          <input
            type="number"
            min={0}
            step="any"
            value={form.reorder_threshold}
            onChange={(e) => setForm({ ...form, reorder_threshold: Number(e.target.value) || 0 })}
            style={{ width: '100%' }}
          />
        </FormField>

        <LineItemsEditor
          label="Ingredients"
          items={form.ingredientLines}
          options={ingredientOptions}
          onChange={(ingredientLines) => setForm({ ...form, ingredientLines })}
        />

        {error && <p style={{ color: 'var(--color-red-text)', fontSize: 13 }}>{error}</p>}

        {editing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            style={{ background: 'none', border: 'none', color: 'var(--color-red-text)', fontSize: 13, padding: 0, marginTop: 4 }}
          >
            Delete component
          </button>
        )}
      </FormModal>
    </>
  );
}
