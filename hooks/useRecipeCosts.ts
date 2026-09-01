import { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';
import type { Recipe, RecipeCost } from '@/types';
import { useApiResource } from './useApiResource';

// Shared by RecipesPage (Flavours tab) and CostingPage — both need the recipe list plus a live
// /cost rollup per recipe.
export function useRecipesWithCost() {
  const { data: recipes, loading, error, reload } = useApiResource<Recipe[]>('/api/recipes');
  const [costs, setCosts] = useState<Record<string, RecipeCost>>({});
  const [costsLoading, setCostsLoading] = useState(false);

  useEffect(() => {
    if (!recipes || recipes.length === 0) {
      setCosts({});
      return;
    }
    setCostsLoading(true);
    Promise.all(recipes.map((r) => api.get<RecipeCost>(`/api/recipes/${r.id}/cost`).then((c) => [r.id, c] as const)))
      .then((pairs) => setCosts(Object.fromEntries(pairs)))
      .finally(() => setCostsLoading(false));
  }, [recipes]);

  return { recipes, costs, loading: loading || costsLoading, error, reload };
}
