import { useState, useEffect, useCallback } from 'react';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiOptions {
  immediate?: boolean;
  retryCount?: number;
  retryDelay?: number;
}

export function useApi<T>(
  apiFunction: () => Promise<T>,
  options: UseApiOptions = {}
) {
  const { immediate = true, retryCount = 3, retryDelay = 1000 } = options;
  
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    let lastError: string | null = null;
    
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        const data = await apiFunction();
        setState({ data, loading: false, error: null });
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Erro desconhecido';
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }
    
    setState(prev => ({ ...prev, loading: false, error: lastError }));
    throw lastError;
  }, [apiFunction, retryCount, retryDelay]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return {
    ...state,
    execute,
    refetch: execute,
  };
}

// Hook para dados com cache
export function useCachedApi<T>(
  apiFunction: () => Promise<T>,
  cacheKey: string,
  cacheTime: number = 5 * 60 * 1000 // 5 minutos
) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async () => {
    // Verificar cache primeiro
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < cacheTime) {
        setState({ data, loading: false, error: null });
        return data;
      }
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await apiFunction();
      
      // Salvar no cache
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      throw errorMessage;
    }
  }, [apiFunction, cacheKey, cacheTime]);

  return {
    ...state,
    execute,
    refetch: execute,
  };
}