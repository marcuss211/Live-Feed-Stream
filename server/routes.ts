import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";

type Provider = "pragmatic" | "playngo" | "netent" | "other";

interface GameDef {
  name: string;
  provider: Provider;
}

const GAMES: GameDef[] = [
  { name: "Gates of Olympus", provider: "pragmatic" },
  { name: "Sweet Bonanza", provider: "pragmatic" },
  { name: "Big Bass Bonanza", provider: "pragmatic" },
  { name: "Sugar Rush", provider: "pragmatic" },
  { name: "Starlight Princess", provider: "pragmatic" },
  { name: "The Dog House", provider: "pragmatic" },
  { name: "Fruit Party", provider: "pragmatic" },
  { name: "Gates of Gatotkaca", provider: "pragmatic" },
  { name: "Buffalo King Megaways", provider: "pragmatic" },
  { name: "Madame Destiny Megaways", provider: "pragmatic" },
  { name: "Floating Dragon", provider: "pragmatic" },
  { name: "Aztec Gems", provider: "pragmatic" },
  { name: "Wolf Gold", provider: "pragmatic" },
  { name: "Wanted Dead or a Wild", provider: "pragmatic" },
  { name: "Extra Chilli Megaways", provider: "pragmatic" },
  { name: "Joker's Jewels", provider: "pragmatic" },
  { name: "Book of Dead", provider: "playngo" },
  { name: "Fire Joker", provider: "playngo" },
  { name: "Legacy of Dead", provider: "playngo" },
  { name: "Reactoonz", provider: "playngo" },
  { name: "Rise of Olympus", provider: "playngo" },
  { name: "Mental", provider: "playngo" },
  { name: "Jammin' Jars", provider: "playngo" },
  { name: "Starburst", provider: "netent" },
  { name: "Gonzo's Quest", provider: "netent" },
  { name: "Dead or Alive 2", provider: "netent" },
  { name: "Bonanza Megaways", provider: "other" },
  { name: "Razor Shark", provider: "other" },
  { name: "Money Train 2", provider: "other" },
  { name: "Eye of Horus", provider: "other" },
];

const GAMES_BY_PROVIDER: Record<Provider, GameDef[]> = {
  pragmatic: GAMES.filter(g => g.provider === "pragmatic"),
  playngo: GAMES.filter(g => g.provider === "playngo"),
  netent: GAMES.filter(g => g.provider === "netent"),
  other: GAMES.filter(g => g.provider === "other"),
};

const PROVIDER_WEIGHTS: { provider: Provider; weight: number }[] = [
  { provider: "pragmatic", weight: 70 },
  { provider: "playngo", weight: 15 },
  { provider: "netent", weight: 8 },
  { provider: "other", weight: 7 },
];

const PRAGMATIC_BET_GAMES = new Set([
  "Gates of Olympus", "Sweet Bonanza", "Big Bass Bonanza",
  "Sugar Rush", "Starlight Princess", "The Dog House",
  "Fruit Party", "Gates of Gatotkaca", "Buffalo King Megaways",
]);

const PRAGMATIC_LADDER = [
  1,2,3,4,5,6,7,8,9,10,12,14,16,18,20,30,40,50,60,70,80,90,100,
  120,140,160,200,240,280,300,320,360,400,500,600,700,800,900,1000,
  1200,1400,1600,1800,2000
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
let megaWinCooldown = 0;
let eventsSinceVisibleWin = 0;
const recentUsers: string[] = [];
const userBetHistory: Map<string, number> = new Map();
const userLadderIndex: Map<string, number> = new Map();

const recentGames: string[] = [];
const recentProviders: Provider[] = [];
const last20Games: string[] = [];

interface ComboKey { game: string; bet: number; multiplier: string }
const recentCombos: ComboKey[] = [];

function getDailySeed(): number {
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number, index: number): number {
  let x = Math.sin(seed + index * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

let eventCounter = 0;

function pickProvider(): Provider {
  const last4 = recentProviders.slice(-4);
  const blockedProvider = (last4.length === 4 && last4.every(p => p === last4[0])) ? last4[0] : null;

  const available = blockedProvider
    ? PROVIDER_WEIGHTS.filter(pw => pw.provider !== blockedProvider)
    : PROVIDER_WEIGHTS;

  const totalWeight = available.reduce((s, pw) => s + pw.weight, 0);
  let roll = Math.random() * totalWeight;
  let selected: Provider = available[0].provider;

  for (const pw of available) {
    if (roll < pw.weight) {
      selected = pw.provider;
      break;
    }
    roll -= pw.weight;
  }

  return selected;
}

function pickGame(): GameDef {
  const provider = pickProvider();
  const pool = GAMES_BY_PROVIDER[provider];

  const lastGame = recentGames.length > 0 ? recentGames[recentGames.length - 1] : null;
  const lastTwoSame = recentGames.length >= 2 &&
    recentGames[recentGames.length - 1] === recentGames[recentGames.length - 2];

  const seed = getDailySeed();
  let candidates = pool.map(g => {
    let weight = 1.0;
    if (last20Games.includes(g.name)) {
      weight *= 0.7;
    }
    weight *= (0.8 + seededRandom(seed, g.name.length + eventCounter) * 0.4);
    if (lastTwoSame && g.name === lastGame) {
      weight = 0;
    }
    return { game: g, weight };
  }).filter(c => c.weight > 0);

  if (candidates.length === 0) {
    candidates = pool.map(g => ({ game: g, weight: 1 }));
  }

  const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * totalWeight;
  let picked = candidates[0].game;
  for (const c of candidates) {
    if (r < c.weight) { picked = c.game; break; }
    r -= c.weight;
  }

  recentGames.push(picked.name);
  if (recentGames.length > 5) recentGames.shift();
  recentProviders.push(picked.provider);
  if (recentProviders.length > 5) recentProviders.shift();
  last20Games.push(picked.name);
  if (last20Games.length > 20) last20Games.shift();

  return picked;
}

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

function ladderIdxRange(minVal: number, maxVal: number): [number, number] {
  let lo = 0;
  let hi = PRAGMATIC_LADDER.length - 1;
  for (let i = 0; i < PRAGMATIC_LADDER.length; i++) {
    if (PRAGMATIC_LADDER[i] >= minVal) { lo = i; break; }
  }
  for (let i = PRAGMATIC_LADDER.length - 1; i >= 0; i--) {
    if (PRAGMATIC_LADDER[i] <= maxVal) { hi = i; break; }
  }
  return [lo, hi];
}

function pickPragmaticLadderBet(): number {
  const roll = Math.random() * 100;
  let minIdx: number, maxIdx: number;

  if (roll < 70) {
    [minIdx, maxIdx] = ladderIdxRange(5, 200);
  } else if (roll < 90) {
    [minIdx, maxIdx] = ladderIdxRange(200, 1000);
  } else {
    [minIdx, maxIdx] = ladderIdxRange(1000, 2000);
  }

  const idx = minIdx + Math.floor(Math.random() * (maxIdx - minIdx + 1));
  return PRAGMATIC_LADDER[Math.min(idx, PRAGMATIC_LADDER.length - 1)];
}

function applyPragmaticUserBehavior(username: string, freshLadderBet: number): number {
  const freshIdx = PRAGMATIC_LADDER.indexOf(freshLadderBet);
  const lastIdx = userLadderIndex.get(username);

  if (lastIdx === undefined || !recentUsers.slice(-6).includes(username)) {
    userLadderIndex.set(username, freshIdx);
    return freshLadderBet;
  }

  const roll = Math.random() * 100;
  let stepDelta: number;
  const isHighBet = PRAGMATIC_LADDER[lastIdx] >= 1000;

  if (isHighBet) {
    if (roll < 50) stepDelta = 0;
    else if (roll < 80) stepDelta = (Math.random() < 0.5 ? -1 : 1);
    else stepDelta = 0;
  } else {
    if (roll < 50) stepDelta = 0;
    else if (roll < 80) stepDelta = (Math.random() < 0.5 ? -1 : 1);
    else if (roll < 95) stepDelta = (Math.random() < 0.5 ? -2 : 2);
    else stepDelta = (Math.random() < 0.5 ? -3 : 3);
  }

  const newIdx = Math.max(0, Math.min(PRAGMATIC_LADDER.length - 1, lastIdx + stepDelta));
  userLadderIndex.set(username, newIdx);
  return PRAGMATIC_LADDER[newIdx];
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

function generateOutcome(betAmount: number, forceVisibleWin: boolean): { type: "WIN" | "LOSS"; multiplier: string | undefined } {
  if (forceVisibleWin) {
    const mult = 5 + Math.random() * 15;
    const rounded = Math.round(mult * 10) / 10;
    return { type: "WIN", multiplier: `${rounded}x` };
  }

  const roll = Math.random() * 100;

  if (roll < 50) {
    return { type: "LOSS", multiplier: undefined };
  }

  let multiplier: number;

  if (roll < 85) {
    multiplier = 1.2 + Math.random() * 2.8;
  } else if (roll < 97) {
    multiplier = 4 + Math.random() * 16;
  } else if (roll < 99.5) {
    if (betAmount > 2000) {
      multiplier = 20 + Math.random() * 30;
    } else {
      multiplier = 20 + Math.random() * 80;
    }
  } else {
    if (megaWinCooldown > 0) {
      if (betAmount > 2000) {
        multiplier = 20 + Math.random() * 30;
      } else {
        multiplier = 20 + Math.random() * 80;
      }
    } else {
      megaWinCooldown = 80;
      if (betAmount > 2000) {
        multiplier = 100 + Math.random() * 100;
      } else {
        multiplier = 100 + Math.random() * 900;
      }
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

function isComboRecent(game: string, bet: number, multiplier: string | undefined): boolean {
  if (!multiplier) return false;
  const key = `${game}|${bet}|${multiplier}`;
  const last60 = recentCombos.slice(-60);
  for (const c of last60) {
    if (`${c.game}|${c.bet}|${c.multiplier}` === key) return true;
  }
  return false;
}

function isComboInLast100(game: string, bet: number, multiplier: string | undefined): boolean {
  if (!multiplier) return false;
  const key = `${game}|${bet}|${multiplier}`;
  for (const c of recentCombos) {
    if (`${c.game}|${c.bet}|${c.multiplier}` === key) return true;
  }
  return false;
}

function generateMockTransaction() {
  eventCounter++;
  if (whaleCooldown > 0) whaleCooldown--;
  if (megaWinCooldown > 0) megaWinCooldown--;
  eventsSinceVisibleWin++;

  const username = pickUsername();
  const gameDef = pickGame();
  const isPragmaticBet = PRAGMATIC_BET_GAMES.has(gameDef.name);

  let finalBet: number;
  if (isPragmaticBet) {
    const ladderBet = pickPragmaticLadderBet();
    finalBet = applyPragmaticUserBehavior(username, ladderBet);
  } else {
    const rawBet = generateBetAmount();
    finalBet = Math.max(5, applyUserBehavior(username, rawBet));
  }

  const forceVisibleWin = eventsSinceVisibleWin >= 15 + Math.floor(seededRandom(getDailySeed(), eventCounter) * 11);

  let outcome = generateOutcome(finalBet, forceVisibleWin);

  if (!forceVisibleWin) {
    let attempts = 0;
    while (attempts < 3 && outcome.type === "WIN" && outcome.multiplier) {
      if (isComboRecent(gameDef.name, finalBet, outcome.multiplier)) {
        outcome = generateOutcome(finalBet, false);
        attempts++;
      } else if (isComboInLast100(gameDef.name, finalBet, outcome.multiplier) && Math.random() < 0.4) {
        outcome = generateOutcome(finalBet, false);
        attempts++;
      } else {
        break;
      }
    }
  }

  if (outcome.type === "WIN" && outcome.multiplier) {
    const mult = parseFloat(outcome.multiplier.replace('x', ''));
    if (mult >= 5) eventsSinceVisibleWin = 0;
    recentCombos.push({ game: gameDef.name, bet: finalBet, multiplier: outcome.multiplier });
    if (recentCombos.length > 100) recentCombos.shift();
  }

  return {
    username,
    amount: finalBet.toFixed(2),
    currency: "₺",
    type: outcome.type,
    game: gameDef.name,
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
