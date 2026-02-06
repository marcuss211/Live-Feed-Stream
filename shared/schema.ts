import { pgTable, text, serial, timestamp, boolean, decimal, integer, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export * from "./models/auth";

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("₺").notNull(),
  type: text("type", { enum: ["WIN", "LOSS"] }).notNull(),
  game: text("game").notNull(),
  multiplier: text("multiplier"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  isSimulation: boolean("is_simulation").default(false),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({ 
  id: true, 
  timestamp: true 
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export const gameConfigs = pgTable("game_configs", {
  id: serial("id").primaryKey(),
  gameId: varchar("game_id", { length: 100 }).notNull().unique(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  imagePath: text("image_path"),
  isActive: boolean("is_active").default(true).notNull(),
  ladderType: text("ladder_type").default("default").notNull(),
  customLadder: text("custom_ladder"),
});

export const insertGameConfigSchema = createInsertSchema(gameConfigs).omit({ id: true });
export type GameConfig = typeof gameConfigs.$inferSelect;
export type InsertGameConfig = z.infer<typeof insertGameConfigSchema>;

export const feedSettings = pgTable("feed_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
});

export type FeedSetting = typeof feedSettings.$inferSelect;

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminUserId: varchar("admin_user_id", { length: 255 }).notNull(),
  adminEmail: text("admin_email"),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;

export interface StatsResponse {
  totalProfit: number;
  todayProfit: number;
  last24hProfit: number;
  transactionCount: number;
}
