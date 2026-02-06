import { useTransactions, useStats } from "@/hooks/use-transactions";
import { TransactionCard } from "@/components/TransactionCard";
import { Ticker } from "@/components/Ticker";
import { StatsBar } from "@/components/StatsBar";
import { AdminPanel } from "@/components/AdminPanel";
import { SimulationControl } from "@/components/SimulationControl";
import { useState, useEffect, useMemo, useCallback } from "react";
import { type Transaction } from "@shared/schema";
import { AnimatePresence } from "framer-motion";
import { Loader2, Search, Radio, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MAX_FEED_ITEMS = 200;

export default function LiveFeed() {
  const [filterType, setFilterType] = useState<'WIN' | 'LOSS' | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [tickerSpeed, setTickerSpeed] = useState<1 | 2 | 3>(1);
  const [simulatedTransactions, setSimulatedTransactions] = useState<Transaction[]>([]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  } = useTransactions({ type: filterType, search: search || undefined, limit: 30 });

  const { data: stats, isLoading: statsLoading } = useStats();

  const allTransactions = useMemo(() => {
    const realTx = data?.pages.flatMap(page => page.items) || [];
    const combined = [...simulatedTransactions, ...realTx];
    const seen = new Set<number>();
    let deduped = combined.filter(tx => {
      if (seen.has(tx.id)) return false;
      seen.add(tx.id);
      return true;
    });
    if (minAmount) {
      const min = parseFloat(minAmount);
      if (!isNaN(min)) {
        deduped = deduped.filter(tx => Number(tx.amount) >= min);
      }
    }
    deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return deduped.slice(0, MAX_FEED_ITEMS);
  }, [data, simulatedTransactions, minAmount]);

  const handleSimulate = useCallback((newTx: Transaction[]) => {
    setSimulatedTransactions(prev => [...newTx, ...prev].slice(0, 80));
  }, []);

  useEffect(() => {
    const container = document.getElementById("feed-scroll-container");
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < 200) {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="h-screen flex flex-col bg-background" data-testid="live-feed-page">
      <Ticker items={allTransactions} speed={tickerSpeed} />
      <StatsBar stats={stats} isLoading={statsLoading} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border/50 bg-card/20">
          <div className="max-w-5xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row items-center gap-2.5 justify-between">
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <div className="relative flex-1 sm:flex-none sm:w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search player..."
                  className="pl-8 bg-secondary/50 border-border/50 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search"
                />
              </div>

              <div className="relative w-24">
                <SlidersHorizontal className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="Min ₺"
                  className="pl-8 bg-secondary/50 border-border/50 text-sm"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  data-testid="input-min-amount"
                />
              </div>

              <div className="flex bg-secondary/40 rounded-md p-0.5 border border-border/30">
                <Button
                  size="sm"
                  variant={filterType === undefined ? "secondary" : "ghost"}
                  onClick={() => setFilterType(undefined)}
                  className="text-xs"
                  data-testid="button-filter-all"
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={filterType === 'WIN' ? "secondary" : "ghost"}
                  onClick={() => setFilterType('WIN')}
                  className="text-xs text-green-400"
                  data-testid="button-filter-win"
                >
                  Wins
                </Button>
                <Button
                  size="sm"
                  variant={filterType === 'LOSS' ? "secondary" : "ghost"}
                  onClick={() => setFilterType('LOSS')}
                  className="text-xs text-red-400"
                  data-testid="button-filter-loss"
                >
                  Losses
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
              <div className="flex items-center gap-1 bg-secondary/40 rounded-md p-0.5 border border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium ml-1.5">Ticker</span>
                {([1, 2, 3] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={tickerSpeed === s ? "secondary" : "ghost"}
                    onClick={() => setTickerSpeed(s)}
                    className="text-xs font-mono"
                    data-testid={`button-ticker-speed-${s}`}
                  >
                    {s}x
                  </Button>
                ))}
              </div>
              <SimulationControl onSimulate={handleSimulate} />
              <AdminPanel />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="max-w-5xl mx-auto h-full flex flex-col">
            <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <Radio className="w-3 h-3 text-green-500 animate-pulse" />
              <span data-testid="text-live-feed-label">Live Feed</span>
              <span className="ml-auto font-mono text-muted-foreground/50" data-testid="text-bet-count">
                {allTransactions.length} bets
              </span>
            </div>

            <div
              id="feed-scroll-container"
              className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5 scrollbar-hide"
            >
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                  <p className="text-sm" data-testid="text-loading">Connecting to feed...</p>
                </div>
              ) : allTransactions.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground text-sm" data-testid="text-empty-state">
                  No transactions found. Start simulation to see live data.
                </div>
              ) : (
                <AnimatePresence initial={false} mode="popLayout">
                  {allTransactions.map((tx) => (
                    <TransactionCard
                      key={tx.id}
                      transaction={tx}
                      isNew={tx.isSimulation === true}
                      compact
                    />
                  ))}
                </AnimatePresence>
              )}

              {isFetchingNextPage && (
                <div className="py-4 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
