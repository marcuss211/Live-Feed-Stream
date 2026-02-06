import { useEffect, useRef, useCallback } from "react";
import { type Transaction } from "@shared/schema";

export function useTransactionStream(onTransaction: (tx: Transaction) => void) {
  const callbackRef = useRef(onTransaction);
  callbackRef.current = onTransaction;

  const connect = useCallback(() => {
    const es = new EventSource("/api/transactions/stream");

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") return;
        callbackRef.current(data as Transaction);
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      es.close();
      setTimeout(connect, 3000);
    };

    return es;
  }, []);

  useEffect(() => {
    const es = connect();
    return () => es.close();
  }, [connect]);
}
