import { useEffect } from 'react';

export function useLiveRefresh(callback: () => void | Promise<void>, intervalMs = 5000) {
  useEffect(() => {
    const timer = setInterval(() => {
      Promise.resolve(callback()).catch(() => {
        // noop
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [callback, intervalMs]);
}
