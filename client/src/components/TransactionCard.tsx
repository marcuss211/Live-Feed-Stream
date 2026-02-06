import { motion } from "framer-motion";
import { forwardRef } from "react";
import { type Transaction } from "@shared/schema";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, User, Dices, Trophy, Flame, Star, Zap, Target, Sparkles } from "lucide-react";
import { clsx } from "clsx";

const GAME_ICONS: Record<string, typeof Dices> = {
  "Sweet Bonanza": Star,
  "Gates of Olympus": Zap,
  "Aviator": TrendingUp,
  "Crash": Flame,
  "Roulette": Target,
  "Blackjack": Dices,
  "Poker": Dices,
  "Baccarat": Dices,
  "Slots": Sparkles,
  "Mines": Target,
  "Plinko": Trophy,
  "Dice": Dices,
  "Limbo": Flame,
};

interface TransactionCardProps {
  transaction: Transaction;
  isNew?: boolean;
  compact?: boolean;
}

export const TransactionCard = forwardRef<HTMLDivElement, TransactionCardProps>(({ transaction, isNew, compact }, ref) => {
  const isWin = transaction.type === "WIN";
  const GameIcon = GAME_ICONS[transaction.game] || Dices;
  const amount = Number(transaction.amount);

  const isBigWin = isWin && amount >= 5000;

  return (
    <motion.div
      ref={ref}
      layout
      initial={isNew ? { opacity: 0, x: -30, scale: 0.97 } : { opacity: 0 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 30, scale: 0.97 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={clsx(
        "group relative rounded-md border transition-all duration-200",
        compact ? "px-3 py-2" : "px-4 py-3",
        "bg-card/80 border-border/50",
        isWin && isBigWin && "border-amber-500/30 bg-amber-500/5",
        isWin && !isBigWin && "border-green-500/15",
        !isWin && "border-red-500/10"
      )}
      data-testid={`card-transaction-${transaction.id}`}
    >
      {isBigWin && (
        <div className="absolute inset-0 rounded-md bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5 pointer-events-none" />
      )}

      <div className="flex items-center gap-3 relative z-10">
        <div className={clsx(
          "flex items-center justify-center rounded-md flex-shrink-0",
          compact ? "w-8 h-8" : "w-9 h-9",
          isWin && isBigWin && "bg-amber-500/15 text-amber-400",
          isWin && !isBigWin && "bg-green-500/10 text-green-400",
          !isWin && "bg-red-500/10 text-red-400"
        )}>
          <GameIcon className={clsx(compact ? "w-4 h-4" : "w-4.5 h-4.5")} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className={clsx(
                "font-semibold text-foreground/90 truncate",
                compact ? "text-xs" : "text-sm"
              )} data-testid={`text-username-${transaction.id}`}>
                {transaction.username}
              </span>
            </div>
            <span className={clsx(
              "text-muted-foreground font-mono flex-shrink-0",
              compact ? "text-[10px]" : "text-xs"
            )}>
              {format(new Date(transaction.timestamp), "HH:mm:ss")}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={clsx(
              "text-muted-foreground truncate",
              compact ? "text-[10px]" : "text-xs"
            )}>
              {transaction.game}
            </span>
            {transaction.multiplier && (
              <span className={clsx(
                "font-mono font-bold rounded px-1 py-px flex-shrink-0",
                compact ? "text-[9px]" : "text-[10px]",
                isWin && isBigWin && "bg-amber-500/15 text-amber-400",
                isWin && !isBigWin && "bg-green-500/10 text-green-400",
                !isWin && "bg-red-500/10 text-red-400"
              )}>
                {transaction.multiplier}
              </span>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className={clsx(
            "font-bold font-mono tabular-nums tracking-tight",
            compact ? "text-sm" : "text-base",
            isWin && isBigWin && "text-amber-400 text-glow-sm",
            isWin && !isBigWin && "text-green-400",
            !isWin && "text-red-400"
          )} data-testid={`text-amount-${transaction.id}`}>
            {isWin ? "+" : "-"}{transaction.currency}{amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

TransactionCard.displayName = "TransactionCard";
