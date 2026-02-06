import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Zap } from "lucide-react";
import { clsx } from "clsx";
import { type Transaction } from "@shared/schema";

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

interface SimulationControlProps {
  onSimulate: (transactions: Transaction[]) => void;
}

export function SimulationControl({ onSimulate }: SimulationControlProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 5>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idCounterRef = useRef(100000);

  const generateMockTransaction = useCallback((): Transaction => {
    const isWin = Math.random() > 0.45;
    const amount = isWin
      ? (Math.random() > 0.9 ? Math.floor(Math.random() * 50000) + 5000 : Math.floor(Math.random() * 5000) + 10)
      : Math.floor(Math.random() * 3000) + 10;

    idCounterRef.current += 1;

    return {
      id: idCounterRef.current,
      username: USERNAMES[Math.floor(Math.random() * USERNAMES.length)],
      amount: amount.toFixed(2),
      currency: "₺",
      type: isWin ? "WIN" : "LOSS",
      game: CASINO_GAMES[Math.floor(Math.random() * CASINO_GAMES.length)],
      multiplier: isWin ? `${(Math.random() * 100 + 1).toFixed(1)}x` : null,
      timestamp: new Date(),
      isSimulation: true,
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      const ms = Math.max(300, 1500 / speed);

      intervalRef.current = setInterval(() => {
        onSimulate([generateMockTransaction()]);
      }, ms);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, onSimulate, generateMockTransaction]);

  return (
    <div className="flex items-center gap-1.5 bg-secondary/50 border border-border/50 rounded-md p-1" data-testid="simulation-control">
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setIsPlaying(!isPlaying)}
        className={clsx(isPlaying && "text-amber-400")}
        data-testid="button-play-pause"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </Button>

      <div className="h-5 w-px bg-border/50" />

      {([1, 2, 5] as const).map((s) => (
        <Button
          key={s}
          size="sm"
          variant={speed === s ? "secondary" : "ghost"}
          onClick={() => setSpeed(s)}
          className={clsx("text-xs font-mono font-bold", speed === s && "text-amber-400")}
          data-testid={`button-speed-${s}x`}
        >
          {s}x
        </Button>
      ))}

      <Zap className={clsx(
        "w-3 h-3 ml-1",
        isPlaying ? "text-amber-400 animate-pulse-glow" : "text-muted-foreground"
      )} />
    </div>
  );
}
