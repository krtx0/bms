import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/apiClient';

export function useApiResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<T>(path)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'))
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
