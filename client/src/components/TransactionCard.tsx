import { memo, useState, useEffect } from "react";
import { type Transaction } from "@shared/schema";
import { Users } from "lucide-react";
import { clsx } from "clsx";

const GAME_IMAGES: Record<string, string> = {
  "Sweet Bonanza": "/images/games/sweet-bonanza.png",
  "Gates of Olympus": "/images/games/gates-of-olympus.png",
  "Gates of Olympus 1000": "/images/games/gates-of-olympus.png",
  "Gates of Olympus Super Scatter": "/images/games/gates-of-olympus.png",
  "Aviator": "/images/games/aviator.png",
  "Crash": "/images/games/crash.png",
  "Roulette": "/images/games/roulette.png",
  "Lightning Roulette": "/images/games/lightning-roulette.png",
  "Blackjack": "/images/games/blackjack.png",
  "Poker": "/images/games/poker.png",
  "Baccarat": "/images/games/baccarat.png",
  "Slots": "/images/games/slots.png",
  "Mines": "/images/games/mines.png",
  "Plinko": "/images/games/plinko.png",
  "Dice": "/images/games/dice.png",
  "Limbo": "/images/games/limbo.png",
  "Big Bass Bonanza": "/images/games/big-bass-bonanza.png",
  "Book of Dead": "/images/games/book-of-dead.png",
  "Crazy Time": "/images/games/crazy-time.png",
  "Monopoly Live": "/images/games/monopoly-live.png",
  "Dream Catcher": "/images/games/dream-catcher.png",
  "Mega Ball": "/images/games/mega-ball.png",
  "40 Burning Hot": "/images/games/burning-hot.png",
  "Black Seven Bell Link": "/images/games/slots.png",
  "100 Bulky Dice Golden Coins Link": "/images/games/dice.png",
  "VIP Flaming Hot Extreme Bell Link": "/images/games/burning-hot.png",
};

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

interface TransactionRowProps {
  transaction: Transaction;
  isNew?: boolean;
}

export const TransactionRow = memo(function TransactionRow({ transaction, isNew }: TransactionRowProps) {
  const [highlight, setHighlight] = useState(isNew);
  const isWin = transaction.type === "WIN";
  const amount = Number(transaction.amount);
  const gameImage = GAME_IMAGES[transaction.game] || "/images/games/slots.png";
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
        "feed-row grid items-center border-b border-border/30 will-change-transform",
        isNew && "feed-row-enter",
        highlight && "feed-row-highlight"
      )}
      data-testid={`row-transaction-${transaction.id}`}
    >
      <div className="flex items-center gap-1 sm:gap-2 min-w-0 py-2 px-2 sm:px-3">
        <Users className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0 hidden sm:block" />
        <span className="text-xs sm:text-sm text-muted-foreground truncate" data-testid={`text-username-${transaction.id}`}>
          Hidden
        </span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 py-2 px-1 sm:px-3">
        <img
          src={gameImage}
          alt={transaction.game}
          className="w-6 h-6 sm:w-8 sm:h-8 rounded-md object-cover flex-shrink-0"
          loading="lazy"
          data-testid={`img-game-${transaction.id}`}
        />
        <span className="text-xs sm:text-sm font-medium text-foreground truncate" data-testid={`text-game-${transaction.id}`}>
          {transaction.game}
        </span>
      </div>

      <div className="py-2 px-1 sm:px-3 min-w-0">
        <span className="text-xs sm:text-sm text-foreground/80 font-mono truncate block" data-testid={`text-bet-amount-${transaction.id}`}>
          {transaction.currency}{amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      <div className="py-2 px-1 sm:px-3 min-w-0 hidden xs:block">
        <span className="text-xs sm:text-sm text-foreground/70 font-mono" data-testid={`text-multiplier-${transaction.id}`}>
          {multiplier > 0 ? `${multiplier.toFixed(2)}x` : "-"}
        </span>
      </div>

      <div className="py-2 px-1 sm:px-3 text-right min-w-0">
        <span className={clsx(
          "text-xs sm:text-sm font-semibold font-mono",
          isWin ? "text-green-400" : "text-red-400"
        )} data-testid={`text-amount-${transaction.id}`}>
          {isWin ? "+" : "-"}{transaction.currency}{absWinnings.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
});
