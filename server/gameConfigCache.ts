import { storage } from "./storage";
import type { GameConfig } from "@shared/schema";

type Provider = "pragmatic" | "playngo" | "netent" | "other";

interface CachedGameDef {
  gameId: string;
  name: string;
  provider: Provider;
  imagePath: string | null;
  ladderType: string;
  customLadder: number[] | null;
}

interface CachedConfig {
  games: CachedGameDef[];
  gamesByProvider: Record<Provider, CachedGameDef[]>;
  providerWeights: { provider: Provider; weight: number }[];
  pragmaticLadder: number[];
  playngoLadder: number[];
  netentLadder: number[];
  hacksawLadder: number[];
  feedParams: Record<string, string>;
  lastRefresh: number;
}

const DEFAULT_PRAGMATIC_LADDER = [
  1,2,3,4,5,6,7,8,9,10,12,14,16,18,20,30,40,50,60,70,80,90,100,
  120,140,160,200,240,280,300,320,360,400,500,600,700,800,900,1000,
  1200,1400,1600,1800,2000
];

const DEFAULT_PLAYNGO_LADDER = [
  1,2,3,5,7,10,15,20,25,30,40,50,75,100,150,200,300,400,500
];

const DEFAULT_NETENT_LADDER = [
  1,2,5,10,20,25,50,75,100,125,150,200,250,500,750,1000
];

const DEFAULT_HACKSAW_LADDER = [
  1,2,3,5,10,15,20,30,50,75,100,150,200,300,500,1000,1500,2000
];

const DEFAULT_PROVIDER_WEIGHTS: { provider: Provider; weight: number }[] = [
  { provider: "pragmatic", weight: 70 },
  { provider: "playngo", weight: 15 },
  { provider: "netent", weight: 8 },
  { provider: "other", weight: 7 },
];

const DEFAULT_GAMES: { gameId: string; name: string; provider: Provider; imagePath: string }[] = [
  { gameId: "gates-of-olympus", name: "Gates of Olympus", provider: "pragmatic", imagePath: "/images/games/gates-of-olympus.png" },
  { gameId: "sweet-bonanza", name: "Sweet Bonanza", provider: "pragmatic", imagePath: "/images/games/sweet-bonanza.png" },
  { gameId: "big-bass-bonanza", name: "Big Bass Bonanza", provider: "pragmatic", imagePath: "/images/games/big-bass-bonanza.png" },
  { gameId: "sugar-rush", name: "Sugar Rush", provider: "pragmatic", imagePath: "/images/games/sugar-rush.png" },
  { gameId: "starlight-princess", name: "Starlight Princess", provider: "pragmatic", imagePath: "/images/games/starlight-princess.png" },
  { gameId: "the-dog-house", name: "The Dog House", provider: "pragmatic", imagePath: "/images/games/the-dog-house.png" },
  { gameId: "fruit-party", name: "Fruit Party", provider: "pragmatic", imagePath: "/images/games/fruit-party.png" },
  { gameId: "gates-of-gatotkaca", name: "Gates of Gatotkaca", provider: "pragmatic", imagePath: "/images/games/gates-of-gatotkaca.png" },
  { gameId: "buffalo-king-megaways", name: "Buffalo King Megaways", provider: "pragmatic", imagePath: "/images/games/buffalo-king-megaways.png" },
  { gameId: "madame-destiny-megaways", name: "Madame Destiny Megaways", provider: "pragmatic", imagePath: "/images/games/madame-destiny-megaways.png" },
  { gameId: "floating-dragon", name: "Floating Dragon", provider: "pragmatic", imagePath: "/images/games/floating-dragon.png" },
  { gameId: "aztec-gems", name: "Aztec Gems", provider: "pragmatic", imagePath: "/images/games/aztec-gems.png" },
  { gameId: "wolf-gold", name: "Wolf Gold", provider: "pragmatic", imagePath: "/images/games/wolf-gold.png" },
  { gameId: "wanted-dead-or-a-wild", name: "Wanted Dead or a Wild", provider: "pragmatic", imagePath: "/images/games/wanted-dead-or-a-wild.png" },
  { gameId: "extra-chilli-megaways", name: "Extra Chilli Megaways", provider: "pragmatic", imagePath: "/images/games/extra-chilli-megaways.png" },
  { gameId: "jokers-jewels", name: "Joker's Jewels", provider: "pragmatic", imagePath: "/images/games/jokers-jewels.png" },
  { gameId: "book-of-dead", name: "Book of Dead", provider: "playngo", imagePath: "/images/games/book-of-dead.png" },
  { gameId: "fire-joker", name: "Fire Joker", provider: "playngo", imagePath: "/images/games/fire-joker.png" },
  { gameId: "legacy-of-dead", name: "Legacy of Dead", provider: "playngo", imagePath: "/images/games/legacy-of-dead.png" },
  { gameId: "reactoonz", name: "Reactoonz", provider: "playngo", imagePath: "/images/games/reactoonz.png" },
  { gameId: "rise-of-olympus", name: "Rise of Olympus", provider: "playngo", imagePath: "/images/games/rise-of-olympus.png" },
  { gameId: "mental", name: "Mental", provider: "playngo", imagePath: "/images/games/mental.png" },
  { gameId: "jammin-jars", name: "Jammin' Jars", provider: "playngo", imagePath: "/images/games/jammin-jars.png" },
  { gameId: "starburst", name: "Starburst", provider: "netent", imagePath: "/images/games/starburst.png" },
  { gameId: "gonzos-quest", name: "Gonzo's Quest", provider: "netent", imagePath: "/images/games/gonzos-quest.png" },
  { gameId: "dead-or-alive-2", name: "Dead or Alive 2", provider: "netent", imagePath: "/images/games/dead-or-alive-2.png" },
  { gameId: "bonanza-megaways", name: "Bonanza Megaways", provider: "other", imagePath: "/images/games/bonanza-megaways.png" },
  { gameId: "razor-shark", name: "Razor Shark", provider: "other", imagePath: "/images/games/razor-shark.png" },
  { gameId: "money-train-2", name: "Money Train 2", provider: "other", imagePath: "/images/games/money-train-2.png" },
  { gameId: "eye-of-horus", name: "Eye of Horus", provider: "other", imagePath: "/images/games/eye-of-horus.png" },
];

const PRAGMATIC_LADDER_GAMES = new Set([
  "Gates of Olympus", "Sweet Bonanza", "Big Bass Bonanza",
  "Sugar Rush", "Starlight Princess", "The Dog House",
  "Fruit Party", "Gates of Gatotkaca", "Buffalo King Megaways",
]);

let cachedConfig: CachedConfig | null = null;

function parseCustomLadder(raw: string | null): number[] | null {
  if (!raw || raw.trim() === "") return null;
  const vals = raw.split(",").map(v => Number(v.trim())).filter(v => !isNaN(v) && v > 0);
  return vals.length > 0 ? vals.sort((a, b) => a - b) : null;
}

export async function initializeGameConfigs(): Promise<void> {
  const existing = await storage.getAllGameConfigs();
  if (existing.length === 0) {
    for (const g of DEFAULT_GAMES) {
      const ladderType = PRAGMATIC_LADDER_GAMES.has(g.name) ? "pragmatic" : "default";
      await storage.upsertGameConfig({
        gameId: g.gameId,
        name: g.name,
        provider: g.provider,
        imagePath: g.imagePath,
        isActive: true,
        ladderType,
        customLadder: null,
      });
    }
    for (const pw of DEFAULT_PROVIDER_WEIGHTS) {
      await storage.setFeedSetting(`provider_weight_${pw.provider}`, String(pw.weight));
    }
  }
}

export async function refreshConfigCache(): Promise<CachedConfig> {
  const allGames = await storage.getAllGameConfigs();
  const allSettings = await storage.getAllFeedSettings();

  const settingsMap: Record<string, string> = {};
  for (const s of allSettings) {
    settingsMap[s.key] = s.value;
  }

  const providers: Provider[] = ["pragmatic", "playngo", "netent", "other"];

  const activeGames: CachedGameDef[] = allGames
    .filter(g => g.isActive)
    .map(g => ({
      gameId: g.gameId,
      name: g.name,
      provider: (providers.includes(g.provider as Provider) ? g.provider : "other") as Provider,
      imagePath: g.imagePath,
      ladderType: g.ladderType,
      customLadder: parseCustomLadder(g.customLadder),
    }));

  const gamesByProvider: Record<Provider, CachedGameDef[]> = {
    pragmatic: [],
    playngo: [],
    netent: [],
    other: [],
  };
  for (const g of activeGames) {
    gamesByProvider[g.provider].push(g);
  }

  const providerWeights: { provider: Provider; weight: number }[] = ([
    { provider: "pragmatic" as Provider, weight: Number(settingsMap.provider_weight_pragmatic || "70") },
    { provider: "playngo" as Provider, weight: Number(settingsMap.provider_weight_playngo || "15") },
    { provider: "netent" as Provider, weight: Number(settingsMap.provider_weight_netent || "8") },
    { provider: "other" as Provider, weight: Number(settingsMap.provider_weight_other || "7") },
  ]).filter(pw => gamesByProvider[pw.provider].length > 0);

  cachedConfig = {
    games: activeGames,
    gamesByProvider,
    providerWeights,
    pragmaticLadder: DEFAULT_PRAGMATIC_LADDER,
    playngoLadder: DEFAULT_PLAYNGO_LADDER,
    netentLadder: DEFAULT_NETENT_LADDER,
    hacksawLadder: DEFAULT_HACKSAW_LADDER,
    feedParams: settingsMap,
    lastRefresh: Date.now(),
  };

  return cachedConfig;
}

export function getConfig(): CachedConfig {
  if (!cachedConfig) {
    throw new Error("Config not initialized. Call refreshConfigCache first.");
  }
  return cachedConfig;
}

export function invalidateCache(): void {
  cachedConfig = null;
}

export function getLadderForGame(game: CachedGameDef): number[] {
  if (game.customLadder && game.customLadder.length > 0) {
    return game.customLadder;
  }
  const cfg = getConfig();
  switch (game.ladderType) {
    case "pragmatic": return cfg.pragmaticLadder;
    case "playngo": return cfg.playngoLadder;
    case "netent": return cfg.netentLadder;
    case "hacksaw": return cfg.hacksawLadder;
    default: return cfg.pragmaticLadder;
  }
}

export function isLadderGame(game: CachedGameDef): boolean {
  return game.ladderType !== "default" || (game.customLadder !== null && game.customLadder.length > 0);
}

export { type CachedGameDef, type CachedConfig, type Provider };
