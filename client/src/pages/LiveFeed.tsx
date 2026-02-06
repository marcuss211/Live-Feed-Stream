import { useTransactions } from "@/hooks/use-transactions";
import { useTransactionStream } from "@/hooks/use-sse";
import { TransactionRow, getWinnings } from "@/components/TransactionCard";
import { AdminPanel } from "@/components/AdminPanel";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { type Transaction } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_FEED_ITEMS = 50;

export default function LiveFeed() {
  const [activeTab, setActiveTab] = useState<"casino" | "top">("casino");
  const [streamedTransactions, setStreamedTransactions] = useState<Transaction[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const newIdsRef = useRef<Set<number>>(new Set());

  const {
    data,
    isLoading
  } = useTransactions({ limit: 30 });

  const handleNewTransaction = useCallback((tx: Transaction) => {
    newIdsRef.current.add(tx.id);
    setTimeout(() => newIdsRef.current.delete(tx.id), 3000);
    setStreamedTransactions(prev => {
      const next = [tx, ...prev];
      if (next.length > MAX_FEED_ITEMS) next.length = MAX_FEED_ITEMS;
      return next;
    });
  }, []);

  useTransactionStream(handleNewTransaction);

  const allTransactions = useMemo(() => {
    const realTx = data?.pages.flatMap(page => page.items) || [];
    const combined = [...streamedTransactions, ...realTx];
    const seen = new Set<number>();
    const deduped = combined.filter(tx => {
      if (seen.has(tx.id)) return false;
      seen.add(tx.id);
      return true;
    });
    deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return deduped.slice(0, MAX_FEED_ITEMS);
  }, [data, streamedTransactions]);

  const topWinners = useMemo(() => {
    return [...allTransactions]
      .filter(tx => tx.type === "WIN" && getWinnings(tx) > 0)
      .sort((a, b) => getWinnings(b) - getWinnings(a))
      .slice(0, MAX_FEED_ITEMS);
  }, [allTransactions]);

  const displayTransactions = activeTab === "casino" ? allTransactions : topWinners;

  useEffect(() => {
    if (isAutoScrolling && feedRef.current && activeTab === "casino") {
      feedRef.current.scrollTop = 0;
    }
  }, [streamedTransactions.length, isAutoScrolling, activeTab]);

  useEffect(() => {
    const container = feedRef.current;
    if (!container) return;

    let userScrollTimeout: ReturnType<typeof setTimeout>;
    const handleInteraction = () => {
      setIsAutoScrolling(false);
      clearTimeout(userScrollTimeout);
      userScrollTimeout = setTimeout(() => setIsAutoScrolling(true), 5000);
    };

    container.addEventListener('wheel', handleInteraction, { passive: true });
    container.addEventListener('touchstart', handleInteraction, { passive: true });
    return () => {
      container.removeEventListener('wheel', handleInteraction);
      container.removeEventListener('touchstart', handleInteraction);
      clearTimeout(userScrollTimeout);
    };
  }, []);

  return (
    <div className="h-[100dvh] flex flex-col bg-background" data-testid="live-feed-page">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col px-2 sm:px-4 py-2 sm:py-4 overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
          <div className="flex items-center bg-card rounded-md p-0.5 sm:p-1 border border-border/50" data-testid="tab-container">
            <Button
              variant={activeTab === "casino" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("casino")}
              className="text-xs sm:text-sm font-semibold"
              data-testid="button-tab-casino"
            >
              Casino
            </Button>
            <Button
              variant={activeTab === "top" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("top")}
              className="text-xs sm:text-sm font-semibold"
              data-testid="button-tab-top"
            >
              Top Kazanclar
            </Button>
          </div>

          <AdminPanel />
        </div>

        <div className="flex-1 overflow-hidden rounded-md border border-border/40 flex flex-col">
          <div className="feed-header grid items-center bg-card/80 backdrop-blur-sm border-b border-border/50 sticky top-0 z-20">
            <div className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider py-2 px-2 sm:px-3" data-testid="th-user">
              Kullanici
            </div>
            <div className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider py-2 px-1 sm:px-3" data-testid="th-game">
              Oyun
            </div>
            <div className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider py-2 px-1 sm:px-3" data-testid="th-bet">
              Bahis
            </div>
            <div className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider py-2 px-1 sm:px-3 hidden xs:block" data-testid="th-multiplier">
              Carpan
            </div>
            <div className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider py-2 px-1 sm:px-3 text-right" data-testid="th-winnings">
              Kazanc
            </div>
          </div>

          <div
            ref={feedRef}
            className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide overscroll-contain"
            data-testid="feed-scroll-container"
          >
            {isLoading ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground py-20">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm" data-testid="text-loading">Feed yukleniyor...</p>
              </div>
            ) : displayTransactions.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-sm text-muted-foreground" data-testid="text-empty-state">
                  Islem bulunamadi.
                </p>
              </div>
            ) : (
              displayTransactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  isNew={newIdsRef.current.has(tx.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
