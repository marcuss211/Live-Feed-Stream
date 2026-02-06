import { motion } from "framer-motion";
import { forwardRef } from "react";
import { type Transaction } from "@shared/schema";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Gamepad2 } from "lucide-react";
import { clsx } from "clsx";

interface TransactionCardProps {
  transaction: Transaction;
  isNew?: boolean;
}

export const TransactionCard = forwardRef<HTMLDivElement, TransactionCardProps>(({ transaction, isNew }, ref) => {
  const isWin = transaction.type === "WIN";

  return (
    <motion.div
      ref={ref}
      layout
      initial={isNew ? { opacity: 0, y: -20, scale: 0.95 } : { opacity: 0 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={clsx(
        "group relative overflow-hidden rounded-xl border p-4 mb-3 transition-colors",
        "bg-card/50 hover:bg-card/80 backdrop-blur-sm",
        isWin 
          ? "border-green-500/10 hover:border-green-500/30" 
          : "border-red-500/10 hover:border-red-500/30"
      )}
    >
      {/* Background Gradient Effect */}
      <div 
        className={clsx(
          "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500",
          isWin 
            ? "bg-gradient-to-r from-green-500/20 via-transparent to-transparent" 
            : "bg-gradient-to-r from-red-500/20 via-transparent to-transparent"
        )} 
      />

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className={clsx(
            "p-2.5 rounded-lg border",
            isWin 
              ? "bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_15px_-5px_rgba(34,197,94,0.3)]" 
              : "bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_15px_-5px_rgba(239,68,68,0.3)]"
          )}>
            {isWin ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-foreground text-lg tracking-tight">
                {transaction.username}
              </span>
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded-md bg-white/5 border border-white/5 font-medium">
                {format(new Date(transaction.timestamp), "HH:mm:ss")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>{transaction.game}</span>
              {transaction.multiplier && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {transaction.multiplier}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className={clsx(
            "text-xl font-bold font-mono tabular-nums tracking-tight",
            isWin ? "text-green-400 text-glow" : "text-red-400"
          )}>
            {isWin ? "+" : "-"}{transaction.currency}{Number(transaction.amount).toFixed(2)}
          </div>
          <div className={clsx(
            "text-xs font-medium uppercase tracking-wider mt-0.5",
            isWin ? "text-green-500/70" : "text-red-500/70"
          )}>
            {transaction.type}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

TransactionCard.displayName = "TransactionCard";
