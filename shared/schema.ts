import { pgTable, text, serial, timestamp, boolean, decimal, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export * from "./models/auth";

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(), // Supports currency values
  currency: text("currency").default("₺").notNull(),
  type: text("type", { enum: ["WIN", "LOSS"] }).notNull(),
  game: text("game").notNull(),
  multiplier: text("multiplier"), // e.g. "2x", "50x"
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  isSimulation: boolean("is_simulation").default(false),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({ 
  id: true, 
  timestamp: true 
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// Stats response type
export interface StatsResponse {
  totalProfit: number;
  todayProfit: number;
  last24hProfit: number;
  transactionCount: number;
}
