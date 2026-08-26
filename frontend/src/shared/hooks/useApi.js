import { useState, useEffect, useCallback, useRef } from 'react';

export function useApi(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (mountedRef.current) setData(result);
    } catch (err) {
      if (mountedRef.current) setError(err.message || 'Something went wrong');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    fetch_();
    return () => { mountedRef.current = false; };
  }, [fetch_]);

  const refetch = useCallback(() => {
    fetch_();
  }, [fetch_]);

  return { data, loading, error, refetch };
}
