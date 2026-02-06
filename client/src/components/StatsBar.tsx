import { type StatsResponse } from "@shared/schema";
import { Activity, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { clsx } from "clsx";

interface StatsBarProps {
  stats?: StatsResponse;
  isLoading: boolean;
}

export function StatsBar({ stats, isLoading }: StatsBarProps) {
  const items = [
    {
      label: "Total P/L",
      value: stats?.totalProfit,
      icon: (stats?.totalProfit || 0) >= 0 ? TrendingUp : TrendingDown,
      format: (v: number) => `${v >= 0 ? "+" : ""}₺${Math.abs(v).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      valueColor: (v: number) => v >= 0 ? "text-green-400" : "text-red-400",
      testId: "text-stat-total-pl",
    },
    {
      label: "Today",
      value: stats?.todayProfit,
      icon: (stats?.todayProfit || 0) >= 0 ? TrendingUp : TrendingDown,
      format: (v: number) => `${v >= 0 ? "+" : ""}₺${Math.abs(v).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      valueColor: (v: number) => v >= 0 ? "text-green-400" : "text-red-400",
      testId: "text-stat-today",
    },
    {
      label: "24h P/L",
      value: stats?.last24hProfit,
      icon: Activity,
      format: (v: number) => `${v >= 0 ? "+" : ""}₺${Math.abs(v).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      valueColor: (v: number) => v >= 0 ? "text-green-400" : "text-red-400",
      testId: "text-stat-24h",
    },
    {
      label: "Bets",
      value: stats?.transactionCount,
      icon: BarChart3,
      format: (v: number) => v.toLocaleString(),
      valueColor: () => "text-amber-400",
      testId: "text-stat-bets",
    },
  ];

  return (
    <div className="border-b border-border/50 bg-card/30" data-testid="stats-bar">
      <div className="max-w-5xl mx-auto px-4 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
          {items.map((item, idx) => {
            const Icon = item.icon;
            const val = item.value ?? 0;
            return (
              <div key={idx} className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-secondary/60">
                  <Icon className={clsx("w-4 h-4", item.valueColor(val))} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    {item.label}
                  </div>
                  <div
                    className={clsx(
                      "text-sm font-bold font-mono tabular-nums tracking-tight truncate",
                      isLoading ? "opacity-30" : "",
                      item.valueColor(val)
                    )}
                    data-testid={item.testId}
                  >
                    {isLoading ? "---" : item.format(val)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
