import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type TransactionInput, type StatsResponse } from "@shared/routes";
import { type Transaction } from "@shared/schema";

// Helper to validate API responses
function validateResponse<T>(schema: any, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error("Schema validation failed:", result.error);
    throw new Error("Invalid API response");
  }
  return result.data;
}

export function useTransactions(params: { limit?: number; type?: 'WIN' | 'LOSS'; search?: string } = {}) {
  return useInfiniteQuery({
    queryKey: [api.transactions.list.path, params],
    queryFn: async ({ pageParam }) => {
      const url = buildUrl(api.transactions.list.path);
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.set("limit", params.limit.toString());
      if (params.type) queryParams.set("type", params.type);
      if (params.search) queryParams.set("search", params.search);
      if (pageParam) queryParams.set("cursor", pageParam.toString());

      const res = await fetch(`${url}?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      
      const data = await res.json();
      return api.transactions.list.responses[200].parse(data);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function useStats() {
  return useQuery({
    queryKey: [api.transactions.stats.path],
    queryFn: async () => {
      const res = await fetch(api.transactions.stats.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.transactions.stats.responses[200].parse(await res.json());
    },
    refetchInterval: 5000, // Refresh stats every 5s
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TransactionInput) => {
      const res = await fetch(api.transactions.create.path, {
        method: api.transactions.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Validation error");
        }
        throw new Error("Failed to create transaction");
      }
      
      return api.transactions.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.transactions.stats.path] });
    },
  });
}
