import { useCallback, useState } from 'react';

/** Hook compartido por los forms de movements para mostrar errores de API. */
export function useServerError() {
  const [serverError, setServerError] = useState<string | null>(null);
  const captureServerError = useCallback((msg: string): void => {
    setServerError(msg);
  }, []);
  const clearServerError = useCallback((): void => {
    setServerError(null);
  }, []);
  return { serverError, captureServerError, clearServerError };
}
