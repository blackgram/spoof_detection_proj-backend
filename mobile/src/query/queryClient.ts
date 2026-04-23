import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      /** Screens override staleTime where needed; this is a conservative default. */
      staleTime: 30_000,
      gcTime: 10 * 60_000,
    },
  },
});
