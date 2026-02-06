import { type StatsResponse } from "@shared/schema";
import { Activity, DollarSign, TrendingUp, BarChart3 } from "lucide-react";
import { clsx } from "clsx";

interface StatsBarProps {
  stats?: StatsResponse;
  isLoading: boolean;
}

export function StatsBar({ stats, isLoading }: StatsBarProps) {
  const items = [
    { 
      label: "Total Profit", 
      value: stats?.totalProfit, 
      icon: DollarSign,
      color: "text-blue-400",
      prefix: "₺" 
    },
    { 
      label: "Today's P/L", 
      value: stats?.todayProfit, 
      icon: TrendingUp,
      color: (stats?.todayProfit || 0) >= 0 ? "text-green-400" : "text-red-400",
      prefix: "₺"
    },
    { 
      label: "Last 24h", 
      value: stats?.last24hProfit, 
      icon: Activity,
      color: (stats?.last24hProfit || 0) >= 0 ? "text-green-400" : "text-red-400",
      prefix: "₺"
    },
    { 
      label: "Transactions", 
      value: stats?.transactionCount, 
      icon: BarChart3,
      color: "text-purple-400",
      prefix: "#"
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 lg:p-6 max-w-7xl mx-auto w-full">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div 
            key={idx}
            className="bg-card/40 backdrop-blur border border-white/5 rounded-2xl p-4 flex flex-col gap-1 shadow-lg hover:bg-card/60 transition-colors"
          >
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </div>
            
            <div className={clsx(
              "text-2xl lg:text-3xl font-bold font-mono tracking-tight",
              isLoading ? "opacity-50 blur-sm" : "opacity-100",
              item.color
            )}>
              {isLoading 
                ? "---" 
                : `${item.prefix}${item.value?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}
