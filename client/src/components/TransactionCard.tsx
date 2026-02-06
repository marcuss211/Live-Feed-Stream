import { memo, useState, useEffect } from "react";
import { type Transaction } from "@shared/schema";
import { Users } from "lucide-react";
import { clsx } from "clsx";

const GAME_IMAGES: Record<string, string> = {
  "Gates of Olympus": "/images/games/gates-of-olympus.png",
  "Sweet Bonanza": "/images/games/sweet-bonanza.png",
  "Big Bass Bonanza": "/images/games/big-bass-bonanza.png",
  "Book of Dead": "/images/games/book-of-dead.png",
  "Wolf Gold": "/images/games/wolf-gold.png",
  "Sugar Rush": "/images/games/sugar-rush.png",
  "Starlight Princess": "/images/games/starlight-princess.png",
  "Wanted Dead or a Wild": "/images/games/wanted-dead-or-wild.png",
  "The Dog House": "/images/games/the-dog-house.png",
  "Fruit Party": "/images/games/fruit-party.png",
  "Fire Joker": "/images/games/fire-joker.png",
  "Legacy of Dead": "/images/games/legacy-of-dead.png",
  "Gates of Gatotkaca": "/images/games/gates-of-gatotkaca.png",
  "Aztec Gems": "/images/games/aztec-gems.png",
  "Madame Destiny Megaways": "/images/games/madame-destiny-megaways.png",
  "Extra Chilli Megaways": "/images/games/extra-chilli-megaways.png",
  "Floating Dragon": "/images/games/floating-dragon.png",
  "Reactoonz": "/images/games/reactoonz.png",
  "Jammin' Jars": "/images/games/jammin-jars.png",
  "Bonanza Megaways": "/images/games/bonanza-megaways.png",
  "Starburst": "/images/games/starburst.png",
  "Gonzo's Quest": "/images/games/gonzos-quest.png",
  "Dead or Alive 2": "/images/games/dead-or-alive-2.png",
  "Razor Shark": "/images/games/razor-shark.png",
  "Rise of Olympus": "/images/games/rise-of-olympus.png",
  "Mental": "/images/games/mental.png",
  "Buffalo King Megaways": "/images/games/buffalo-king-megaways.png",
  "Money Train 2": "/images/games/money-train-2.png",
  "Eye of Horus": "/images/games/eye-of-horus.png",
  "Joker's Jewels": "/images/games/jokers-jewels.png",
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
          Gizli
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
          {isWin && multiplier > 0 ? `${multiplier.toFixed(1)}x` : "\u2013"}
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
