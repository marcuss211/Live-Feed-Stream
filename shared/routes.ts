import { z } from 'zod';
import { insertTransactionSchema, transactions } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  transactions: {
    list: {
      method: 'GET' as const,
      path: '/api/transactions',
      input: z.object({
        limit: z.coerce.number().optional().default(50),
        cursor: z.coerce.number().optional(), // ID based cursor
        type: z.enum(['WIN', 'LOSS']).optional(),
        search: z.string().optional(),
      }).optional(),
      responses: {
        200: z.object({
          items: z.array(z.custom<typeof transactions.$inferSelect>()),
          nextCursor: z.number().optional(),
        }),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/transactions',
      input: insertTransactionSchema,
      responses: {
        201: z.custom<typeof transactions.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    stats: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.object({
          totalProfit: z.number(),
          todayProfit: z.number(),
          last24hProfit: z.number(),
          transactionCount: z.number(),
        }),
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type TransactionInput = z.infer<typeof api.transactions.create.input>;
