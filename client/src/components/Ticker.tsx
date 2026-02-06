import { motion } from "framer-motion";
import { type Transaction } from "@shared/schema";
import { TrendingUp } from "lucide-react";

interface TickerProps {
  items: Transaction[];
}

export function Ticker({ items }: TickerProps) {
  const wins = items.filter(t => t.type === "WIN" && Number(t.amount) > 0);
  
  // If no high value wins, show generic welcome messages
  const displayItems = wins.length > 0 ? wins : [
    { id: '1', username: 'System', amount: '1000', currency: '₺', game: 'Welcome', type: 'WIN' },
    { id: '2', username: 'System', amount: '5000', currency: '₺', game: 'Start Playing', type: 'WIN' },
  ];

  return (
    <div className="h-10 bg-black/40 border-b border-white/5 overflow-hidden flex items-center relative z-40 backdrop-blur-md">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10" />
      
      <div className="flex whitespace-nowrap overflow-hidden">
        <motion.div
          className="flex gap-12 px-4"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            repeat: Infinity,
            ease: "linear",
            duration: Math.max(20, displayItems.length * 3), // Adjust speed based on content
          }}
        >
          {/* Duplicate list for seamless loop */}
          {[...displayItems, ...displayItems].map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="flex items-center gap-2 text-sm font-medium">
              <span className="text-muted-foreground">
                <span className="font-bold text-primary-foreground">{item.username}</span> just won
              </span>
              <span className="text-green-400 font-mono font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {item.currency}{Number(item.amount).toFixed(2)}
              </span>
              <span className="text-muted-foreground/60 text-xs uppercase bg-white/5 px-1.5 rounded">
                on {item.game}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
