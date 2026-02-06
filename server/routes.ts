import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";

const CASINO_GAMES = [
  "Gates of Olympus",
  "Sweet Bonanza",
  "Big Bass Bonanza",
  "Book of Dead",
  "Wolf Gold",
  "Sugar Rush",
  "Starlight Princess",
  "Wanted Dead or a Wild",
  "The Dog House",
  "Fruit Party",
  "Fire Joker",
  "Legacy of Dead",
  "Gates of Gatotkaca",
  "Aztec Gems",
  "Madame Destiny Megaways",
  "Extra Chilli Megaways",
  "Floating Dragon",
  "Reactoonz",
  "Jammin' Jars",
  "Bonanza Megaways",
  "Starburst",
  "Gonzo's Quest",
  "Dead or Alive 2",
  "Razor Shark",
  "Rise of Olympus",
  "Mental",
  "Buffalo King Megaways",
  "Money Train 2",
  "Eye of Horus",
  "Joker's Jewels",
];

const USERNAMES = [
  "Gizli_01", "Oyuncu_42", "Kral_77", "Yildiz_09", "Seker_33",
  "Altin_55", "Hizli_88", "Deniz_14", "Gece_67", "Bulut_22",
  "Kartal_91", "Nehir_03", "Ayla_56", "Toprak_78", "Firtina_45",
  "Celik_19", "Gumus_64", "Ates_37", "Dalga_82", "Kaplan_11",
  "Bora_53", "Yilmaz_96", "Duman_28", "Elmas_70", "Kurt_15",
  "Simsek_49", "Pars_86", "Volkan_31", "Aslan_63", "Sahin_07",
];

const sseClients = new Set<Response>();

function broadcastTransaction(tx: object) {
  const data = `data: ${JSON.stringify(tx)}\n\n`;
  for (const client of sseClients) {
    client.write(data);
  }
}

let whaleCooldown = 0;
const recentUsers: string[] = [];
const userBetHistory: Map<string, number> = new Map();

function pickNaturalBetAmount(min: number, max: number): number {
  const raw = min + Math.random() * (max - min);

  if (raw < 20) return Math.round(raw);
  if (raw < 100) {
    const rounded = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 100];
    return rounded.reduce((prev, curr) =>
      Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev
    );
  }
  if (raw < 500) {
    const base = Math.round(raw / 25) * 25;
    const jitter = Math.random() < 0.3 ? Math.round((Math.random() - 0.5) * 20) : 0;
    return Math.max(25, base + jitter);
  }
  if (raw < 2000) {
    const base = Math.round(raw / 50) * 50;
    const jitter = Math.random() < 0.25 ? Math.round((Math.random() - 0.5) * 50) : 0;
    return Math.max(50, base + jitter);
  }
  if (raw < 10000) {
    const base = Math.round(raw / 250) * 250;
    const jitter = Math.random() < 0.2 ? Math.round((Math.random() - 0.5) * 200) : 0;
    return Math.max(250, base + jitter);
  }
  const base = Math.round(raw / 1000) * 1000;
  const jitter = Math.random() < 0.15 ? Math.round((Math.random() - 0.5) * 500) : 0;
  return Math.max(1000, base + jitter);
}

function generateBetAmount(): number {
  const roll = Math.random() * 100;

  if (roll < 70) {
    return pickNaturalBetAmount(5, 250);
  } else if (roll < 90) {
    return pickNaturalBetAmount(250, 1500);
  } else if (roll < 97) {
    return pickNaturalBetAmount(1500, 7500);
  } else if (roll < 99.5) {
    return pickNaturalBetAmount(7500, 25000);
  } else {
    if (whaleCooldown > 0) {
      return pickNaturalBetAmount(1500, 7500);
    }
    whaleCooldown = 20 + Math.floor(Math.random() * 21);
    return pickNaturalBetAmount(25000, 120000);
  }
}

function generateOutcome(betAmount: number): { type: "WIN" | "LOSS"; multiplier: string | undefined } {
  const roll = Math.random() * 100;

  if (roll < 58) {
    return { type: "LOSS", multiplier: undefined };
  }

  let multiplier: number;

  if (roll < 90) {
    multiplier = 1.1 + Math.random() * 2.9;
  } else if (roll < 98) {
    multiplier = 4 + Math.random() * 16;
  } else if (roll < 99.8) {
    if (betAmount > 5000) {
      multiplier = 20 + Math.random() * 30;
    } else {
      multiplier = 20 + Math.random() * 100;
    }
  } else {
    if (betAmount > 2000) {
      multiplier = 120 + Math.random() * 80;
    } else {
      multiplier = 120 + Math.random() * 880;
    }
  }

  const rounded = Math.round(multiplier * 10) / 10;
  return { type: "WIN", multiplier: `${rounded}x` };
}

function pickUsername(): string {
  let candidate: string;
  let attempts = 0;

  do {
    candidate = USERNAMES[Math.floor(Math.random() * USERNAMES.length)];
    attempts++;
  } while (recentUsers.slice(-2).includes(candidate) && attempts < 10);

  recentUsers.push(candidate);
  if (recentUsers.length > 10) recentUsers.shift();

  return candidate;
}

function applyUserBehavior(username: string, baseBet: number): number {
  const lastBet = userBetHistory.get(username);
  if (lastBet !== undefined) {
    const drift = 0.7 + Math.random() * 0.6;
    const blended = Math.round(lastBet * drift * 0.4 + baseBet * 0.6);
    userBetHistory.set(username, blended);
    return blended;
  }
  userBetHistory.set(username, baseBet);
  return baseBet;
}

function generateMockTransaction() {
  if (whaleCooldown > 0) whaleCooldown--;

  const username = pickUsername();
  const rawBet = generateBetAmount();
  const betAmount = applyUserBehavior(username, rawBet);
  const finalBet = Math.max(5, betAmount);
  const outcome = generateOutcome(finalBet);

  return {
    username,
    amount: finalBet.toFixed(2),
    currency: "₺",
    type: outcome.type,
    game: CASINO_GAMES[Math.floor(Math.random() * CASINO_GAMES.length)],
    multiplier: outcome.multiplier,
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
    console.log("Seeding database with realistic transactions...");
    for (let i = 0; i < 20; i++) {
      const mock = generateMockTransaction();
      await storage.createTransaction(mock as any);
    }
    console.log("Database seeded!");
  }
}
