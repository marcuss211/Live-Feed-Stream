import { memo, useState, useEffect } from "react";
import { type Transaction } from "@shared/schema";
import { Users } from "lucide-react";
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";

function parseMultiplier(m: string | null | undefined): number {
  if (!m) return 0;
  const val = parseFloat(m.replace(/x$/i, ""));
  return isNaN(val) ? 0 : val;
}

export function getWinnings(tx: Transaction): number {
  const bet = Number(tx.amount);
  const mult = parseMultiplier(tx.multiplier);
  if (tx.type === "WIN") {
    return mult > 0 ? bet * mult : bet;
  }
  return -bet;
}

export function useGameImages() {
  return useQuery<Record<string, string>>({
    queryKey: ["/api/game-images"],
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

interface TransactionRowProps {
  transaction: Transaction;
  isNew?: boolean;
  gameImages?: Record<string, string>;
}

export const TransactionRow = memo(function TransactionRow({ transaction, isNew, gameImages }: TransactionRowProps) {
  const [highlight, setHighlight] = useState(isNew);
  const isWin = transaction.type === "WIN";
  const amount = Number(transaction.amount);
  const gameImage = gameImages?.[transaction.game] || "/images/games/slots.png";
  const multiplier = parseMultiplier(transaction.multiplier);
  const winnings = getWinnings(transaction);
  const absWinnings = Math.abs(winnings);

  useEffect(() => {
    if (!isNew) return;
    const t = setTimeout(() => setHighlight(false), 1800);
    return () => clearTimeout(t);
  }, [isNew]);

  return (
    <div
      className={clsx(
        "feed-row grid items-center border-b border-border/30",
        isNew && "feed-row-enter",
        highlight && "feed-row-highlight"
      )}
      data-testid={`row-transaction-${transaction.id}`}
    >
      <div className="flex items-center gap-1 sm:gap-2 min-w-0 py-1.5 sm:py-2 px-1.5 sm:px-3">
        <Users className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0 hidden sm:block" />
        <span className="text-[10px] sm:text-sm text-muted-foreground truncate" data-testid={`text-username-${transaction.id}`}>
          Gizli
        </span>
      </div>

      <div className="flex items-center gap-1 sm:gap-2.5 min-w-0 py-1.5 sm:py-2 px-1 sm:px-3">
        <img
          src={gameImage}
          alt={transaction.game}
          className="w-6 h-6 sm:w-8 sm:h-8 rounded flex-shrink-0 object-cover"
          loading="lazy"
          data-testid={`img-game-${transaction.id}`}
        />
        <span className="feed-game-name text-[10px] sm:text-sm font-medium text-foreground" data-testid={`text-game-${transaction.id}`}>
          {transaction.game}
        </span>
      </div>

      <div className="py-1.5 sm:py-2 px-1 sm:px-3 min-w-0 text-right sm:text-left">
        <span className="feed-value text-[10px] sm:text-sm text-foreground/80 font-mono block" data-testid={`text-bet-amount-${transaction.id}`}>
          {transaction.currency}{amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      <div className="py-1.5 sm:py-2 px-1 sm:px-3 min-w-0 hidden xs:block">
        <span className="text-xs sm:text-sm text-foreground/70 font-mono" data-testid={`text-multiplier-${transaction.id}`}>
          {isWin && multiplier > 0 ? `${multiplier.toFixed(1)}x` : "\u2013"}
        </span>
      </div>

      <div className="py-1.5 sm:py-2 px-1 sm:px-3 text-right min-w-0">
        <span className={clsx(
          "feed-value text-[10px] sm:text-sm font-semibold font-mono",
          isWin ? "text-green-400" : "text-red-400"
        )} data-testid={`text-amount-${transaction.id}`}>
          {isWin ? "+" : "-"}{transaction.currency}{absWinnings.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
});
