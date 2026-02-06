import { type Transaction } from "@shared/schema";
import { Trophy } from "lucide-react";
import { clsx } from "clsx";
import { useRef, useEffect, useState } from "react";

interface TickerProps {
  items: Transaction[];
  speed?: number;
}

export function Ticker({ items, speed = 1 }: TickerProps) {
  const wins = items.filter(t => t.type === "WIN" && Number(t.amount) > 100);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayItems = wins.length > 0 ? wins.slice(0, 20) : [
    { id: 0, username: "Casino", amount: "1000", currency: "₺", game: "Sweet Bonanza", type: "WIN" as const, multiplier: "5x", timestamp: new Date(), isSimulation: false },
    { id: -1, username: "Lucky", amount: "2500", currency: "₺", game: "Aviator", type: "WIN" as const, multiplier: "12x", timestamp: new Date(), isSimulation: false },
    { id: -2, username: "VIP", amount: "10000", currency: "₺", game: "Gates of Olympus", type: "WIN" as const, multiplier: "50x", timestamp: new Date(), isSimulation: false },
  ];

  const duration = Math.max(15, displayItems.length * 4) / speed;

  return (
    <div className="h-9 bg-gradient-to-r from-amber-500/5 via-card/80 to-amber-500/5 border-b border-amber-500/10 flex items-center relative z-40 overflow-hidden" data-testid="ticker-bar">
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background via-background/80 to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background via-background/80 to-transparent z-10" />

      <div className="flex whitespace-nowrap" ref={containerRef}>
        <div
          className="flex gap-8 px-4 animate-ticker"
          style={{ "--ticker-duration": `${duration}s` } as React.CSSProperties}
        >
          {[...displayItems, ...displayItems].map((item, idx) => {
            const amount = Number(item.amount);
            const isBig = amount >= 5000;
            return (
              <div key={`${item.id}-${idx}`} className="flex items-center gap-1.5 text-xs">
                <Trophy className={clsx(
                  "w-3 h-3 flex-shrink-0",
                  isBig ? "text-amber-400" : "text-green-500/70"
                )} />
                <span className="text-foreground/70 font-medium">
                  {item.username}
                </span>
                <span className={clsx(
                  "font-mono font-bold",
                  isBig ? "text-amber-400" : "text-green-400"
                )}>
                  +{item.currency}{amount.toLocaleString('tr-TR')}
                </span>
                <span className="text-muted-foreground/50 text-[10px]">
                  {item.game}
                </span>
                {item.multiplier && (
                  <span className={clsx(
                    "text-[9px] font-mono font-bold px-1 rounded",
                    isBig ? "text-amber-400/80 bg-amber-400/10" : "text-green-400/60 bg-green-400/5"
                  )}>
                    {item.multiplier}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
