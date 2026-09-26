import { QueryClient } from "@tanstack/react-query";

// Retry network errors and 5xx twice; never retry 4xx (docs/02 §3 — TanStack Query).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => {
        const status = err?.response?.status;
        if (status && status < 500) return false;
        return count < 2;
      },
    },
    mutations: { retry: false },
  },
});
