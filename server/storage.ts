import { transactions, type Transaction, type InsertTransaction, type StatsResponse } from "@shared/schema";
import { db } from "./db";
import { desc, eq, sql, gt, and } from "drizzle-orm";
// Re-export auth storage
export * from "./replit_integrations/auth/storage";

export interface IStorage {
  // Transaction methods
  getTransactions(limit: number, cursor?: number, type?: 'WIN' | 'LOSS', search?: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getStats(): Promise<StatsResponse>;
}

export class DatabaseStorage implements IStorage {
  async getTransactions(limit: number, cursor?: number, type?: 'WIN' | 'LOSS', search?: string): Promise<Transaction[]> {
    const conditions = [];
    
    if (cursor) {
      conditions.push(sql`${transactions.id} < ${cursor}`);
    }
    
    if (type) {
      conditions.push(eq(transactions.type, type));
    }
    
    if (search) {
      conditions.push(sql`${transactions.username} ILIKE ${`%${search}%`}`);
    }

    return await db.select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.id))
      .limit(limit);
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async getStats(): Promise<StatsResponse> {
    // Calculate total profit (Wins - Losses)
    // For simplicity, we'll assume "Amount" is always positive in DB, 
    // and we subtract if type is LOSS.
    // Or users might input negative for loss. Let's assume standard casino tracking:
    // WIN adds to payout (House Loss), LOSS adds to revenue (House Win)? 
    // The user prompt says "Profit/Loss" likely from USER perspective or HOUSE perspective?
    // Usually "Live Feed" shows user wins. 
    // Let's assume P/L is from the platform's perspective or the user's total?
    // "Total Profit/Loss" usually implies the HOUSE P/L in an admin dashboard, 
    // OR it could be the sum of all user winnings?
    // Let's assume:
    // WIN = User won (House lost) -> Negative P/L for house?
    // LOSS = User lost (House won) -> Positive P/L for house?
    // User asked for "Total Profit/Loss". Let's simply sum:
    // If Type=WIN, amount is positive. If Type=LOSS, amount is negative (or vice versa).
    // Let's stick to the visual: WIN = Green (User won), LOSS = Red (User lost).
    // Let's calculate "Net P/L" as (Sum of Wins - Sum of Losses).
    // Wait, typically "Profit" means how much the *platform* made.
    // Platform Profit = Sum(Losses) - Sum(Wins).
    
    const stats = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'LOSS' THEN amount ELSE -amount END), 0) as total_profit,
        COUNT(*) as tx_count,
        COALESCE(SUM(CASE 
          WHEN timestamp > NOW() - INTERVAL '24 hours' AND type = 'LOSS' THEN amount 
          WHEN timestamp > NOW() - INTERVAL '24 hours' AND type = 'WIN' THEN -amount 
          ELSE 0 
        END), 0) as last_24h_profit,
        COALESCE(SUM(CASE 
          WHEN date_trunc('day', timestamp) = date_trunc('day', NOW()) AND type = 'LOSS' THEN amount 
          WHEN date_trunc('day', timestamp) = date_trunc('day', NOW()) AND type = 'WIN' THEN -amount 
          ELSE 0 
        END), 0) as today_profit
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
}

export const storage = new DatabaseStorage();
