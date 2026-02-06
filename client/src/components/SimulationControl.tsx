import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Zap } from "lucide-react";
import { clsx } from "clsx";
import { type Transaction } from "@shared/schema";

interface SimulationControlProps {
  onSimulate: (transactions: Transaction[]) => void;
}

export function SimulationControl({ onSimulate }: SimulationControlProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 5>(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const generateMockTransaction = (): Transaction => {
    const isWin = Math.random() > 0.5;
    const amount = Math.floor(Math.random() * 5000) + 10;
    const games = ["Roulette", "Blackjack", "Slots", "Poker", "Baccarat"];
    const users = ["CryptoKing", "LuckyUser", "WhaleWatcher", "DiamondHands", "MoonWalker", "Satoshi"];
    
    return {
      id: Math.floor(Math.random() * 1000000),
      username: users[Math.floor(Math.random() * users.length)],
      amount: amount.toString(), // Schema expects decimal string or number
      currency: "₺",
      type: isWin ? "WIN" : "LOSS",
      game: games[Math.floor(Math.random() * games.length)],
      multiplier: isWin ? `${(Math.random() * 5 + 1).toFixed(1)}x` : null,
      timestamp: new Date(),
      isSimulation: true
    };
  };

  useEffect(() => {
    if (isPlaying) {
      const ms = 2000 / speed; // Base 2 seconds, divided by speed
      
      intervalRef.current = setInterval(() => {
        onSimulate([generateMockTransaction()]);
      }, ms);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, onSimulate]);

  return (
    <div className="flex items-center gap-2 bg-card/50 backdrop-blur-md border border-white/10 rounded-lg p-1.5">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsPlaying(!isPlaying)}
        className={clsx(
          "h-8 w-8 p-0 rounded-md transition-all",
          isPlaying ? "text-amber-400 bg-amber-400/10" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </Button>

      <div className="h-4 w-px bg-white/10 mx-1" />

      {[1, 2, 5].map((s) => (
        <Button
          key={s}
          size="sm"
          variant="ghost"
          onClick={() => setSpeed(s as 1 | 2 | 5)}
          className={clsx(
            "h-8 px-2.5 text-xs font-mono font-bold transition-all rounded-md",
            speed === s 
              ? "bg-primary/20 text-primary shadow-[0_0_10px_-3px_rgba(59,130,246,0.5)]" 
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          )}
        >
          {s}x
        </Button>
      ))}
      
      <div className="ml-2 flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
        <Zap className={clsx("w-3 h-3", isPlaying && "text-amber-400 fill-amber-400 animate-pulse")} />
        <span className="hidden sm:inline">Demo Mode</span>
      </div>
    </div>
  );
}
