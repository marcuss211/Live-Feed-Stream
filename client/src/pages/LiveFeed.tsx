import { useTransactions, useStats } from "@/hooks/use-transactions";
import { TransactionCard } from "@/components/TransactionCard";
import { Ticker } from "@/components/Ticker";
import { StatsBar } from "@/components/StatsBar";
import { AdminPanel } from "@/components/AdminPanel";
import { SimulationControl } from "@/components/SimulationControl";
import { useState, useEffect, useMemo } from "react";
import { type Transaction } from "@shared/schema";
import { AnimatePresence } from "framer-motion";
import { Loader2, Search, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LiveFeed() {
  const [filterType, setFilterType] = useState<'WIN' | 'LOSS' | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [simulatedTransactions, setSimulatedTransactions] = useState<Transaction[]>([]);

  // Fetch real data
  const { 
    data, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage, 
    isLoading 
  } = useTransactions({ type: filterType, search: searchDebounce(search), limit: 20 });

  const { data: stats, isLoading: statsLoading } = useStats();

  // Combine real + simulated data
  const allTransactions = useMemo(() => {
    const realTx = data?.pages.flatMap(page => page.items) || [];
    // Merge simulated on top, sort by date desc
    const combined = [...simulatedTransactions, ...realTx].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    // Dedup by ID just in case
    const seen = new Set();
    return combined.filter(tx => {
      const duplicate = seen.has(tx.id);
      seen.add(tx.id);
      return !duplicate;
    });
  }, [data, simulatedTransactions]);

  // Handle Simulation
  const handleSimulate = (newTx: Transaction[]) => {
    setSimulatedTransactions(prev => [...newTx, ...prev].slice(0, 50)); // Keep last 50 sim items
  };

  // Simple Debounce for Search
  function searchDebounce(val: string) {
    // In a real app use useDebounce hook, here we just return val for simplicity 
    // or rely on React's batching. For this demo, direct pass is fine.
    return val;
  }

  // Infinite Scroll Handler
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop 
        !== document.documentElement.offsetHeight
      ) return;
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Ticker */}
        <Ticker items={allTransactions} />

        {/* Stats Dashboard */}
        <StatsBar stats={stats} isLoading={statsLoading} />

        {/* Main Content */}
        <div className="flex-1 max-w-3xl w-full mx-auto p-4 lg:p-6 space-y-6">
          
          {/* Controls Bar */}
          <div className="sticky top-4 z-30 bg-card/80 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl flex flex-col md:flex-row gap-3 justify-between items-center">
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search user..." 
                  className="pl-9 h-10 bg-background/50 border-transparent focus:border-primary/50 transition-colors"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              
              <div className="flex bg-background/50 rounded-lg p-1 border border-white/5">
                <Button 
                  size="sm" 
                  variant={filterType === undefined ? "secondary" : "ghost"}
                  onClick={() => setFilterType(undefined)}
                  className="h-8 text-xs"
                >All</Button>
                <Button 
                  size="sm" 
                  variant={filterType === 'WIN' ? "secondary" : "ghost"}
                  onClick={() => setFilterType('WIN')}
                  className="h-8 text-xs text-green-400 hover:text-green-300"
                >Wins</Button>
                <Button 
                  size="sm" 
                  variant={filterType === 'LOSS' ? "secondary" : "ghost"}
                  onClick={() => setFilterType('LOSS')}
                  className="h-8 text-xs text-red-400 hover:text-red-300"
                >Losses</Button>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <SimulationControl onSimulate={handleSimulate} />
              <AdminPanel />
            </div>
          </div>

          {/* Feed */}
          <div className="space-y-4 min-h-[500px]">
            <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-widest px-1">
              <History className="w-4 h-4" />
              Live Transactions
            </div>
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p>Connecting to feed...</p>
              </div>
            ) : allTransactions.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground border border-dashed border-white/10 rounded-xl bg-white/5">
                No transactions found. Try simulating some!
              </div>
            ) : (
              <AnimatePresence initial={false} mode="popLayout">
                {allTransactions.map((tx) => (
                  <TransactionCard 
                    key={tx.id} 
                    transaction={tx} 
                    isNew={tx.isSimulation} // Animate new sim items specially
                  />
                ))}
              </AnimatePresence>
            )}

            {isFetchingNextPage && (
              <div className="py-4 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            )}
            
            {/* Infinite Scroll Spacer */}
            <div className="h-20" /> 
          </div>
        </div>
      </div>
    </div>
  );
}
