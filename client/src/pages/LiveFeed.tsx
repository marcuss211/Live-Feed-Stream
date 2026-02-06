import { useTransactions } from "@/hooks/use-transactions";
import { TransactionRow, getWinnings } from "@/components/TransactionCard";
import { AdminPanel } from "@/components/AdminPanel";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { type Transaction } from "@shared/schema";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_FEED_ITEMS = 200;

const CASINO_GAMES = [
  "Sweet Bonanza", "Gates of Olympus", "Gates of Olympus 1000",
  "Gates of Olympus Super Scatter", "Aviator", "Crash",
  "Roulette", "Blackjack", "Poker", "Baccarat", "Slots",
  "Mines", "Plinko", "Dice", "Limbo", "Big Bass Bonanza",
  "Book of Dead", "Crazy Time", "Lightning Roulette",
  "Monopoly Live", "Dream Catcher", "Mega Ball",
  "40 Burning Hot", "Black Seven Bell Link",
  "100 Bulky Dice Golden Coins Link",
  "VIP Flaming Hot Extreme Bell Link"
];

const USERNAMES = [
  "CasinoVIP", "LuckyAce", "HighRoller99", "DiamondHands",
  "MoonWalker", "CryptoKing", "Player777", "GoldRush",
  "SlotMaster", "BigWinner", "JackpotHunter", "RoyalFlush",
  "TurboSpin", "WhaleBet", "NeonPlayer", "StarGambler",
  "BetKing", "ProGamer", "SilverFox", "OceanBet"
];

function generateMockTransaction(id: number): Transaction {
  const isWin = Math.random() > 0.45;
  const amount = isWin
    ? (Math.random() > 0.9 ? Math.floor(Math.random() * 50000) + 5000 : Math.floor(Math.random() * 5000) + 10)
    : Math.floor(Math.random() * 3000) + 10;

  return {
    id,
    username: USERNAMES[Math.floor(Math.random() * USERNAMES.length)],
    amount: amount.toFixed(2),
    currency: "₺",
    type: isWin ? "WIN" : "LOSS",
    game: CASINO_GAMES[Math.floor(Math.random() * CASINO_GAMES.length)],
    multiplier: isWin ? `${(Math.random() * 100 + 1).toFixed(1)}x` : null,
    timestamp: new Date(),
    isSimulation: true,
  };
}

export default function LiveFeed() {
  const [activeTab, setActiveTab] = useState<"casino" | "top">("casino");
  const [simulatedTransactions, setSimulatedTransactions] = useState<Transaction[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const idCounterRef = useRef(100000);

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
    deduped.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return deduped.slice(-MAX_FEED_ITEMS);
  }, [data, simulatedTransactions]);

  const topWinners = useMemo(() => {
    return [...allTransactions]
      .filter(tx => tx.type === "WIN")
      .sort((a, b) => getWinnings(b) - getWinnings(a))
      .slice(0, 50);
  }, [allTransactions]);

  const displayTransactions = activeTab === "casino" ? allTransactions : topWinners;

  useEffect(() => {
    const ms = 1200;
    const interval = setInterval(() => {
      idCounterRef.current += 1;
      const newTx = generateMockTransaction(idCounterRef.current);
      setSimulatedTransactions(prev => [...prev, newTx].slice(-80));
    }, ms);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isAutoScrolling && scrollRef.current) {
      const container = scrollRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [displayTransactions.length, isAutoScrolling]);

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
      const { scrollTop } = container;
      if (scrollTop < 100) {
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
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col px-2 sm:px-4 py-3 sm:py-6 overflow-hidden">
        <div className="flex items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4 flex-wrap">
          <div className="flex items-center bg-card rounded-lg p-1 border border-border/50" data-testid="tab-container">
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

        <div className="flex-1 overflow-hidden rounded-lg border border-border/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]" data-testid="transaction-table">
              <thead className="sticky top-0 z-20">
                <tr className="bg-card/80 backdrop-blur-sm border-b border-border/50">
                  <th className="text-left text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider py-2 sm:py-3 px-2 sm:px-4 w-[14%]" data-testid="th-user">
                    Kullanici
                  </th>
                  <th className="text-left text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider py-2 sm:py-3 px-2 sm:px-4 w-[30%]" data-testid="th-game">
                    Oyun
                  </th>
                  <th className="text-left text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider py-2 sm:py-3 px-2 sm:px-4 w-[18%]" data-testid="th-bet">
                    Bahis Miktari
                  </th>
                  <th className="text-left text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider py-2 sm:py-3 px-2 sm:px-4 w-[14%]" data-testid="th-multiplier">
                    Carpan
                  </th>
                  <th className="text-right text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider py-2 sm:py-3 px-2 sm:px-4 w-[24%]" data-testid="th-winnings">
                    Kazanc
                  </th>
                </tr>
              </thead>
            </table>
          </div>

          <div
            ref={scrollRef}
            className="overflow-y-auto overflow-x-auto scrollbar-hide"
            style={{ height: 'calc(100% - 41px)' }}
            data-testid="feed-scroll-container"
          >
            <table className="w-full min-w-[500px]">
              <colgroup>
                <col style={{ width: '14%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '24%' }} />
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
                        Islem bulunamadi.
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
