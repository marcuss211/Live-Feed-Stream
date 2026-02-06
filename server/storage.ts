import { transactions, type Transaction, type InsertTransaction, type StatsResponse, gameConfigs, type GameConfig, type InsertGameConfig, feedSettings, type FeedSetting, auditLogs, type AuditLog } from "@shared/schema";
import { users } from "@shared/schema";
import { db } from "./db";
import { desc, eq, sql, and, asc } from "drizzle-orm";
export * from "./replit_integrations/auth/storage";

export interface IStorage {
  getTransactions(limit: number, cursor?: number, type?: 'WIN' | 'LOSS', search?: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getStats(): Promise<StatsResponse>;

  getAllGameConfigs(): Promise<GameConfig[]>;
  getGameConfig(gameId: string): Promise<GameConfig | undefined>;
  upsertGameConfig(config: InsertGameConfig): Promise<GameConfig>;
  updateGameConfig(gameId: string, updates: Partial<InsertGameConfig>): Promise<GameConfig | undefined>;
  softDeleteGameConfig(gameId: string): Promise<GameConfig | undefined>;

  getFeedSetting(key: string): Promise<string | undefined>;
  setFeedSetting(key: string, value: string): Promise<void>;
  getAllFeedSettings(): Promise<FeedSetting[]>;

  createAuditLog(log: { adminUserId: string; adminEmail?: string; entity: string; entityId?: string; field: string; oldValue?: string; newValue?: string }): Promise<AuditLog>;
  getAuditLogs(limit: number, offset: number): Promise<AuditLog[]>;

  getUserRole(userId: string): Promise<string | undefined>;
  setUserRole(userId: string, role: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getTransactions(limit: number, cursor?: number, type?: 'WIN' | 'LOSS', search?: string): Promise<Transaction[]> {
    const conditions = [];
    if (cursor) conditions.push(sql`${transactions.id} < ${cursor}`);
    if (type) conditions.push(eq(transactions.type, type));
    if (search) conditions.push(sql`${transactions.username} ILIKE ${`%${search}%`}`);
    return await db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.id)).limit(limit);
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    return newTransaction;
  }

  async getStats(): Promise<StatsResponse> {
    const stats = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'LOSS' THEN amount ELSE -amount END), 0) as total_profit,
        COUNT(*) as tx_count,
        COALESCE(SUM(CASE WHEN timestamp > NOW() - INTERVAL '24 hours' AND type = 'LOSS' THEN amount WHEN timestamp > NOW() - INTERVAL '24 hours' AND type = 'WIN' THEN -amount ELSE 0 END), 0) as last_24h_profit,
        COALESCE(SUM(CASE WHEN date_trunc('day', timestamp) = date_trunc('day', NOW()) AND type = 'LOSS' THEN amount WHEN date_trunc('day', timestamp) = date_trunc('day', NOW()) AND type = 'WIN' THEN -amount ELSE 0 END), 0) as today_profit
      FROM transactions
    `);
    const row = stats.rows[0];
    return {
      totalProfit: Number(row.total_profit),
      todayProfit: Number(row.today_profit),
      last24hProfit: Number(row.last_24h_profit),
      transactionCount: Number(row.tx_count),
    };
  }

  async getAllGameConfigs(): Promise<GameConfig[]> {
    return await db.select().from(gameConfigs).where(eq(gameConfigs.isDeleted, false)).orderBy(asc(gameConfigs.id));
  }

  async getGameConfig(gameId: string): Promise<GameConfig | undefined> {
    const [config] = await db.select().from(gameConfigs).where(eq(gameConfigs.gameId, gameId));
    return config;
  }

  async upsertGameConfig(config: InsertGameConfig): Promise<GameConfig> {
    const [result] = await db.insert(gameConfigs).values(config).onConflictDoUpdate({
      target: gameConfigs.gameId,
      set: {
        name: config.name,
        provider: config.provider,
        imagePath: config.imagePath,
        isActive: config.isActive,
        ladderType: config.ladderType,
        customLadder: config.customLadder,
      },
    }).returning();
    return result;
  }

  async updateGameConfig(gameId: string, updates: Partial<InsertGameConfig>): Promise<GameConfig | undefined> {
    const [result] = await db.update(gameConfigs).set(updates).where(eq(gameConfigs.gameId, gameId)).returning();
    return result;
  }

  async softDeleteGameConfig(gameId: string): Promise<GameConfig | undefined> {
    const [result] = await db.update(gameConfigs).set({ isDeleted: true, isActive: false }).where(eq(gameConfigs.gameId, gameId)).returning();
    return result;
  }

  async getFeedSetting(key: string): Promise<string | undefined> {
    const [setting] = await db.select().from(feedSettings).where(eq(feedSettings.key, key));
    return setting?.value;
  }

  async setFeedSetting(key: string, value: string): Promise<void> {
    await db.insert(feedSettings).values({ key, value }).onConflictDoUpdate({
      target: feedSettings.key,
      set: { value },
    });
  }

  async getAllFeedSettings(): Promise<FeedSetting[]> {
    return await db.select().from(feedSettings);
  }

  async createAuditLog(log: { adminUserId: string; adminEmail?: string; entity: string; entityId?: string; field: string; oldValue?: string; newValue?: string }): Promise<AuditLog> {
    const [result] = await db.insert(auditLogs).values(log).returning();
    return result;
  }

  async getAuditLogs(limit: number, offset: number): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(limit).offset(offset);
  }

  async getUserRole(userId: string): Promise<string | undefined> {
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    return user?.role ?? undefined;
  }

  async setUserRole(userId: string, role: string): Promise<void> {
    await db.update(users).set({ role }).where(eq(users.id, userId));
  }
}

export const storage = new DatabaseStorage();
