import { useTransactions } from "@/hooks/use-transactions";
import { TransactionRow, getWinnings } from "@/components/TransactionCard";
import { AdminPanel } from "@/components/AdminPanel";
import { SimulationControl } from "@/components/SimulationControl";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { type Transaction } from "@shared/schema";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_FEED_ITEMS = 200;

export default function LiveFeed() {
  const [activeTab, setActiveTab] = useState<"casino" | "top">("casino");
  const [simulatedTransactions, setSimulatedTransactions] = useState<Transaction[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  } = useTransactions({ limit: 50 });

  const allTransactions = useMemo(() => {
    const realTx = data?.pages.flatMap(page => page.items) || [];
    const combined = [...simulatedTransactions, ...realTx];
    const seen = new Set<number>();
    const deduped = combined.filter(tx => {
      if (seen.has(tx.id)) return false;
      seen.add(tx.id);
      return true;
    });
    deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return deduped.slice(0, MAX_FEED_ITEMS);
  }, [data, simulatedTransactions]);

  const topWinners = useMemo(() => {
    return [...allTransactions]
      .filter(tx => tx.type === "WIN")
      .sort((a, b) => getWinnings(b) - getWinnings(a))
      .slice(0, 50);
  }, [allTransactions]);

  const displayTransactions = activeTab === "casino" ? allTransactions : topWinners;

  const handleSimulate = useCallback((newTx: Transaction[]) => {
    setSimulatedTransactions(prev => [...newTx, ...prev].slice(0, 80));
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !isAutoScrolling) return;

    autoScrollRef.current = setInterval(() => {
      if (container.scrollTop < container.scrollHeight - container.clientHeight) {
        container.scrollTop += 1;
      } else {
        container.scrollTop = 0;
      }
    }, 30);

    return () => {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    };
  }, [isAutoScrolling, displayTransactions.length]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let userScrollTimeout: ReturnType<typeof setTimeout>;
    const handleWheel = () => {
      setIsAutoScrolling(false);
      clearTimeout(userScrollTimeout);
      userScrollTimeout = setTimeout(() => setIsAutoScrolling(true), 5000);
    };

    container.addEventListener('wheel', handleWheel);
    container.addEventListener('touchstart', handleWheel);
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleWheel);
      clearTimeout(userScrollTimeout);
    };
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
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
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col px-4 py-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center bg-card rounded-lg p-1 border border-border/50" data-testid="tab-container">
            <Button
              variant={activeTab === "casino" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("casino")}
              className="text-sm font-semibold"
              data-testid="button-tab-casino"
            >
              Casino
            </Button>
            <Button
              variant={activeTab === "top" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("top")}
              className="text-sm font-semibold"
              data-testid="button-tab-top"
            >
              Top Kazanclar
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <SimulationControl onSimulate={handleSimulate} />
            <AdminPanel />
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-lg border border-border/40">
          <table className="w-full table-fixed" data-testid="transaction-table">
            <thead className="sticky top-0 z-20">
              <tr className="bg-card/80 backdrop-blur-sm border-b border-border/50">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 w-[15%]" data-testid="th-user">
                  Kullanici
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 w-[30%]" data-testid="th-game">
                  Oyun
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 w-[18%]" data-testid="th-bet">
                  Bahis Miktari
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 w-[15%]" data-testid="th-multiplier">
                  Carpan
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider py-3 px-4 w-[22%]" data-testid="th-winnings">
                  Kazanc
                </th>
              </tr>
            </thead>
          </table>

          <div
            ref={scrollRef}
            className="overflow-y-auto scrollbar-hide"
            style={{ height: 'calc(100% - 41px)' }}
            data-testid="feed-scroll-container"
          >
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: '15%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '22%' }} />
              </colgroup>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <p className="text-sm" data-testid="text-loading">Feed yukleniyor...</p>
                      </div>
                    </td>
                  </tr>
                ) : displayTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-20">
                      <p className="text-sm text-muted-foreground" data-testid="text-empty-state">
                        Islem bulunamadi. Simulasyonu baslatarak canli veri gorebilirsiniz.
                      </p>
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence initial={false}>
                    {displayTransactions.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        transaction={tx}
                        isNew={tx.isSimulation === true}
                      />
                    ))}
                  </AnimatePresence>
                )}

                {isFetchingNextPage && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
