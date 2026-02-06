import type { Express, Response, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { getConfig, refreshConfigCache, initializeGameConfigs, invalidateCache, getLadderForGame, isLadderGame, type CachedGameDef, type Provider } from "./gameConfigCache";
import path from "path";
import fs from "fs";

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

let eventCounter = 0;

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

function pickProvider(): Provider {
  const cfg = getConfig();
  const last4 = recentProviders.slice(-4);
  const blockedProvider = (last4.length === 4 && last4.every(p => p === last4[0])) ? last4[0] : null;

  const available = blockedProvider
    ? cfg.providerWeights.filter(pw => pw.provider !== blockedProvider)
    : cfg.providerWeights;

  if (available.length === 0) return cfg.providerWeights[0]?.provider || "pragmatic";

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

function pickGame(): CachedGameDef {
  const cfg = getConfig();
  const provider = pickProvider();
  const pool = cfg.gamesByProvider[provider];

  if (!pool || pool.length === 0) {
    return cfg.games[0];
  }

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

function ladderIdxRange(ladder: number[], minVal: number, maxVal: number): [number, number] {
  let lo = 0;
  let hi = ladder.length - 1;
  for (let i = 0; i < ladder.length; i++) {
    if (ladder[i] >= minVal) { lo = i; break; }
  }
  for (let i = ladder.length - 1; i >= 0; i--) {
    if (ladder[i] <= maxVal) { hi = i; break; }
  }
  return [lo, hi];
}

function pickLadderBet(ladder: number[]): number {
  const maxVal = ladder[ladder.length - 1];
  const roll = Math.random() * 100;
  let minIdx: number, maxIdx: number;

  if (roll < 70) {
    [minIdx, maxIdx] = ladderIdxRange(ladder, 5, Math.min(200, maxVal));
  } else if (roll < 90) {
    [minIdx, maxIdx] = ladderIdxRange(ladder, 200, Math.min(1000, maxVal));
  } else {
    [minIdx, maxIdx] = ladderIdxRange(ladder, 1000, maxVal);
  }

  if (minIdx > maxIdx) [minIdx, maxIdx] = [0, ladder.length - 1];
  const idx = minIdx + Math.floor(Math.random() * (maxIdx - minIdx + 1));
  return ladder[Math.min(idx, ladder.length - 1)];
}

function applyLadderUserBehavior(username: string, freshLadderBet: number, ladder: number[]): number {
  const freshIdx = ladder.indexOf(freshLadderBet);
  const lastIdx = userLadderIndex.get(username);

  if (lastIdx === undefined || !recentUsers.slice(-6).includes(username)) {
    userLadderIndex.set(username, freshIdx);
    return freshLadderBet;
  }

  const roll = Math.random() * 100;
  let stepDelta: number;
  const isHighBet = ladder[lastIdx] >= 1000;

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

  const newIdx = Math.max(0, Math.min(ladder.length - 1, lastIdx + stepDelta));
  userLadderIndex.set(username, newIdx);
  return ladder[newIdx];
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
  if (roll < 50) return { type: "LOSS", multiplier: undefined };

  let multiplier: number;
  if (roll < 85) {
    multiplier = 1.2 + Math.random() * 2.8;
  } else if (roll < 97) {
    multiplier = 4 + Math.random() * 16;
  } else if (roll < 99.5) {
    if (betAmount > 2000) multiplier = 20 + Math.random() * 30;
    else multiplier = 20 + Math.random() * 80;
  } else {
    if (megaWinCooldown > 0) {
      if (betAmount > 2000) multiplier = 20 + Math.random() * 30;
      else multiplier = 20 + Math.random() * 80;
    } else {
      megaWinCooldown = 80;
      if (betAmount > 2000) multiplier = 100 + Math.random() * 100;
      else multiplier = 100 + Math.random() * 900;
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

  const cfg = getConfig();
  if (cfg.games.length === 0) return null;

  const username = pickUsername();
  const gameDef = pickGame();
  const useLadder = isLadderGame(gameDef);

  let finalBet: number;
  if (useLadder) {
    const ladder = getLadderForGame(gameDef);
    const ladderBet = pickLadderBet(ladder);
    finalBet = applyLadderUserBehavior(username, ladderBet, ladder);
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

const isAdmin: RequestHandler = async (req: any, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const userId = req.user?.claims?.sub;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const role = await storage.getUserRole(userId);
  if (role !== "super_admin" && role !== "content_manager") {
    return res.status(403).json({ message: "Forbidden" });
  }
  (req as any).adminRole = role;
  next();
};

const isSuperAdmin: RequestHandler = async (req: any, res, next) => {
  if ((req as any).adminRole !== "super_admin") {
    return res.status(403).json({ message: "SuperAdmin access required" });
  }
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  await initializeGameConfigs();
  await refreshConfigCache();

  app.get(api.transactions.list.path, async (req, res) => {
    try {
      const query = api.transactions.list.input?.parse(req.query) || {};
      const txs = await storage.getTransactions(
        query.limit || 50,
        query.cursor,
        query.type,
        query.search
      );
      const nextCursor = txs.length > 0 ? txs[txs.length - 1].id : undefined;
      res.json({ items: txs, nextCursor });
    } catch (error) {
      console.error("List transactions error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.transactions.create.path, async (req, res) => {
    try {
      const body = { ...req.body };
      if (typeof body.amount === 'number') body.amount = body.amount.toString();
      const input = api.transactions.create.input.parse(body);
      const transaction = await storage.createTransaction(input);
      broadcastTransaction(transaction);
      res.status(201).json(transaction);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
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

  app.get("/api/game-images", async (_req, res) => {
    try {
      const allGames = await storage.getAllGameConfigs();
      const map: Record<string, string> = {};
      for (const g of allGames) {
        if (g.imagePath) map[g.name] = g.imagePath;
      }
      res.json(map);
    } catch {
      res.json({});
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
    req.on("close", () => { sseClients.delete(res); });
  });

  app.get("/api/admin/games", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const games = await storage.getAllGameConfigs();
      res.json(games);
    } catch (error) {
      console.error("Get games error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const gameUpdateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    provider: z.enum(["pragmatic", "playngo", "netent", "other"]).optional(),
    isActive: z.boolean().optional(),
    ladderType: z.enum(["default", "pragmatic", "playngo", "netent", "hacksaw", "custom"]).optional(),
    customLadder: z.string().max(2000).nullable().optional(),
    imagePath: z.string().max(500).optional(),
  });

  app.put("/api/admin/games/:gameId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { gameId } = req.params;
      const userId = req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;

      const parsed = gameUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }

      const existing = await storage.getGameConfig(gameId);
      if (!existing) return res.status(404).json({ message: "Game not found" });

      if (parsed.data.customLadder) {
        const vals = parsed.data.customLadder.split(",").map(v => Number(v.trim()));
        if (vals.some(v => isNaN(v) || v <= 0)) {
          return res.status(400).json({ message: "Custom ladder must be comma-separated positive numbers" });
        }
        for (let i = 1; i < vals.length; i++) {
          if (vals[i] <= vals[i - 1]) {
            return res.status(400).json({ message: "Custom ladder values must be in ascending order" });
          }
        }
      }

      const updates: any = {};
      const fields = ["name", "provider", "isActive", "ladderType", "customLadder", "imagePath"] as const;
      for (const field of fields) {
        if ((parsed.data as any)[field] !== undefined && (parsed.data as any)[field] !== (existing as any)[field]) {
          const oldVal = String((existing as any)[field] ?? "");
          const newVal = String((parsed.data as any)[field] ?? "");
          updates[field] = (parsed.data as any)[field];
          await storage.createAuditLog({
            adminUserId: userId,
            adminEmail: userEmail,
            entity: "game_config",
            entityId: gameId,
            field,
            oldValue: oldVal,
            newValue: newVal,
          });
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.json(existing);
      }

      const updated = await storage.updateGameConfig(gameId, updates);
      invalidateCache();
      await refreshConfigCache();
      res.json(updated);
    } catch (error) {
      console.error("Update game error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/games/:gameId/image", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { gameId } = req.params;
      const userId = req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;

      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", async () => {
        try {
          const buffer = Buffer.concat(chunks);
          if (buffer.length === 0) return res.status(400).json({ message: "No file uploaded" });
          if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ message: "File too large (max 5MB)" });

          const header = buffer.slice(0, 8);
          const isPng = header[0] === 0x89 && header[1] === 0x50;
          const isJpg = header[0] === 0xFF && header[1] === 0xD8;
          const isWebp = header[8] === 0x57 || (header[0] === 0x52 && header[1] === 0x49);
          if (!isPng && !isJpg && !isWebp) return res.status(400).json({ message: "Invalid image format (PNG, JPG, WebP only)" });

          const ext = isPng ? "png" : isJpg ? "jpg" : "webp";
          const filename = `${gameId}.${ext}`;
          const imgDir = path.join(process.cwd(), "client", "public", "images", "games");
          if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
          const filePath = path.join(imgDir, filename);
          fs.writeFileSync(filePath, buffer);

          if (!fs.existsSync(filePath)) {
            return res.status(500).json({ message: "Dosya kaydedilemedi" });
          }

          const imagePath = `/images/games/${filename}?v=${Date.now()}`;
          const existing = await storage.getGameConfig(gameId);
          if (!existing) {
            return res.status(404).json({ message: "Oyun bulunamadi" });
          }
          const oldPath = existing.imagePath || "";

          const updated = await storage.updateGameConfig(gameId, { imagePath });
          if (!updated) {
            return res.status(500).json({ message: "Veritabani guncellenemedi" });
          }

          await storage.createAuditLog({
            adminUserId: userId,
            adminEmail: userEmail,
            entity: "game_config",
            entityId: gameId,
            field: "imagePath",
            oldValue: oldPath,
            newValue: imagePath,
          });

          invalidateCache();
          await refreshConfigCache();
          res.json({ imagePath, success: true });
        } catch (err) {
          console.error("Image upload error:", err);
          res.status(500).json({ message: "Upload failed" });
        }
      });
    } catch (error) {
      console.error("Image upload error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/settings", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const settings = await storage.getAllFeedSettings();
      const result: Record<string, string> = {};
      for (const s of settings) result[s.key] = s.value;
      res.json(result);
    } catch (error) {
      console.error("Get settings error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const settingsUpdateSchema = z.record(z.string().max(100), z.string().max(500));

  app.put("/api/admin/settings", isAuthenticated, isAdmin, isSuperAdmin, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;

      const parsed = settingsUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid settings data" });
      }
      const updates = parsed.data;

      for (const key of Object.keys(updates)) {
        if (key.startsWith("provider_weight_")) {
          const w = Number(updates[key]);
          if (isNaN(w) || w < 0 || w > 100) {
            return res.status(400).json({ message: `Invalid weight for ${key}: must be 0-100` });
          }
        }
      }

      for (const [key, value] of Object.entries(updates)) {
        const existing = await storage.getFeedSetting(key);
        await storage.setFeedSetting(key, value);
        await storage.createAuditLog({
          adminUserId: userId,
          adminEmail: userEmail,
          entity: "feed_settings",
          entityId: key,
          field: key,
          oldValue: existing || "",
          newValue: value,
        });
      }

      invalidateCache();
      await refreshConfigCache();
      const allSettings = await storage.getAllFeedSettings();
      const result: Record<string, string> = {};
      for (const s of allSettings) result[s.key] = s.value;
      res.json(result);
    } catch (error) {
      console.error("Update settings error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/audit-logs", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;
      const logs = await storage.getAuditLogs(limit, offset);
      res.json(logs);
    } catch (error) {
      console.error("Get audit logs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      let role = await storage.getUserRole(userId);

      if (!role || role === "user") {
        const allSettings = await storage.getAllFeedSettings();
        const bootstrapped = allSettings.find(s => s.key === "admin_bootstrapped");
        if (!bootstrapped) {
          await storage.setUserRole(userId, "super_admin");
          await storage.setFeedSetting("admin_bootstrapped", "true");
          await storage.createAuditLog({
            adminUserId: "system",
            adminEmail: "system",
            entity: "user",
            entityId: userId,
            field: "role",
            oldValue: role || "user",
            newValue: "super_admin",
          });
          role = "super_admin";
        }
      }

      res.json({ userId, role: role || "user" });
    } catch (error) {
      console.error("Get admin me error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/promote", isAuthenticated, isAdmin, isSuperAdmin, async (req: any, res) => {
    try {
      const { targetUserId, role } = req.body;
      if (!targetUserId || !["super_admin", "content_manager", "user"].includes(role)) {
        return res.status(400).json({ message: "Invalid request" });
      }
      const userId = req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;
      const oldRole = await storage.getUserRole(targetUserId);
      await storage.setUserRole(targetUserId, role);
      await storage.createAuditLog({
        adminUserId: userId,
        adminEmail: userEmail,
        entity: "user",
        entityId: targetUserId,
        field: "role",
        oldValue: oldRole || "user",
        newValue: role,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Promote user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  await seedDatabase();

  setInterval(async () => {
    try {
      const mock = generateMockTransaction();
      if (!mock) return;
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
      if (mock) await storage.createTransaction(mock as any);
    }
    console.log("Database seeded!");
  }
}
