import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";

const CASINO_GAMES = [
  "Sweet Bonanza", "Gates of Olympus", "Gates of Olympus 1000",
  "Gates of Olympus Super Scatter", "Aviator", "Crash",
  "Roulette", "Blackjack", "Poker", "Baccarat", "Slots",
  "Mines", "Plinko", "Dice", "Limbo", "Big Bass Bonanza",
  "Book of Dead", "Crazy Time", "Lightning Roulette",
  "Monopoly Live", "Dream Catcher", "Mega Ball",
  "40 Burning Hot", "Black Seven Bell Link",
  "100 Bulky Dice Golden Coins Link",
  "VIP Flaming Hot Extreme Bell Link"
];

const USERNAMES = [
  "CasinoVIP", "LuckyAce", "HighRoller99", "DiamondHands",
  "MoonWalker", "CryptoKing", "Player777", "GoldRush",
  "SlotMaster", "BigWinner", "JackpotHunter", "RoyalFlush",
  "TurboSpin", "WhaleBet", "NeonPlayer", "StarGambler",
  "BetKing", "ProGamer", "SilverFox", "OceanBet"
];

const sseClients = new Set<Response>();

function broadcastTransaction(tx: object) {
  const data = `data: ${JSON.stringify(tx)}\n\n`;
  for (const client of sseClients) {
    client.write(data);
  }
}

function generateMockTransaction() {
  const isWin = Math.random() > 0.45;
  const amount = isWin
    ? (Math.random() > 0.9 ? Math.floor(Math.random() * 50000) + 5000 : Math.floor(Math.random() * 5000) + 10)
    : Math.floor(Math.random() * 3000) + 10;

  return {
    username: USERNAMES[Math.floor(Math.random() * USERNAMES.length)],
    amount: amount.toFixed(2),
    currency: "₺",
    type: isWin ? "WIN" : "LOSS",
    game: CASINO_GAMES[Math.floor(Math.random() * CASINO_GAMES.length)],
    multiplier: isWin ? `${(Math.random() * 100 + 1).toFixed(1)}x` : undefined,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get(api.transactions.list.path, async (req, res) => {
    try {
      const query = api.transactions.list.input?.parse(req.query) || {};
      const transactions = await storage.getTransactions(
        query.limit || 50,
        query.cursor,
        query.type,
        query.search
      );
      const nextCursor = transactions.length > 0 ? transactions[transactions.length - 1].id : undefined;
      res.json({ items: transactions, nextCursor });
    } catch (error) {
      console.error("List transactions error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.transactions.create.path, async (req, res) => {
    try {
      const body = { ...req.body };
      if (typeof body.amount === 'number') {
        body.amount = body.amount.toString();
      }
      const input = api.transactions.create.input.parse(body);
      const transaction = await storage.createTransaction(input);
      broadcastTransaction(transaction);
      res.status(201).json(transaction);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      } else {
        console.error("Create transaction error:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get(api.transactions.stats.path, async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/transactions/stream", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write("data: {\"type\":\"connected\"}\n\n");
    sseClients.add(res);
    req.on("close", () => {
      sseClients.delete(res);
    });
  });

  await seedDatabase();

  setInterval(async () => {
    try {
      const mock = generateMockTransaction();
      const tx = await storage.createTransaction(mock as any);
      broadcastTransaction(tx);
    } catch (e) {
      // ignore
    }
  }, 1500);

  return httpServer;
}

async function seedDatabase() {
  const existing = await storage.getTransactions(1);
  if (existing.length === 0) {
    console.log("Seeding database...");
    const seedData = [
      { username: "CasinoVIP", amount: "25000.00", currency: "₺", type: "WIN", game: "Gates of Olympus", multiplier: "125.5x" },
      { username: "LuckyAce", amount: "3200.00", currency: "₺", type: "WIN", game: "Sweet Bonanza", multiplier: "32x" },
      { username: "HighRoller99", amount: "8500.00", currency: "₺", type: "LOSS", game: "Blackjack" },
      { username: "Player777", amount: "1500.00", currency: "₺", type: "WIN", game: "Aviator", multiplier: "3.2x" },
      { username: "GoldRush", amount: "450.00", currency: "₺", type: "LOSS", game: "Crash" },
      { username: "DiamondHands", amount: "12000.00", currency: "₺", type: "WIN", game: "Lightning Roulette", multiplier: "50x" },
      { username: "SlotMaster", amount: "2100.00", currency: "₺", type: "LOSS", game: "Book of Dead" },
      { username: "BigWinner", amount: "7800.00", currency: "₺", type: "WIN", game: "Crazy Time", multiplier: "15.6x" },
      { username: "NeonPlayer", amount: "950.00", currency: "₺", type: "LOSS", game: "Plinko" },
      { username: "WhaleBet", amount: "35000.00", currency: "₺", type: "WIN", game: "Mines", multiplier: "87.5x" },
      { username: "ProGamer", amount: "180.00", currency: "₺", type: "WIN", game: "Dice", multiplier: "2.1x" },
      { username: "StarGambler", amount: "5600.00", currency: "₺", type: "LOSS", game: "Baccarat" },
      { username: "JackpotHunter", amount: "15500.00", currency: "₺", type: "WIN", game: "Big Bass Bonanza", multiplier: "62x" },
      { username: "BetKing", amount: "720.00", currency: "₺", type: "WIN", game: "Limbo", multiplier: "4.8x" },
      { username: "TurboSpin", amount: "3400.00", currency: "₺", type: "LOSS", game: "Monopoly Live" },
    ];
    for (const data of seedData) {
      // @ts-ignore
      await storage.createTransaction(data);
    }
    console.log("Database seeded!");
  }
}
