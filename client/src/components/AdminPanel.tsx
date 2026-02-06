import { useCreateTransaction } from "@/hooks/use-transactions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTransactionSchema } from "@shared/schema";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const CASINO_GAMES = [
  "Sweet Bonanza", "Gates of Olympus", "Aviator", "Crash",
  "Roulette", "Blackjack", "Poker", "Baccarat", "Slots",
  "Mines", "Plinko", "Dice", "Limbo", "Big Bass Bonanza",
  "Book of Dead", "Crazy Time", "Lightning Roulette",
];

const formSchema = insertTransactionSchema.extend({
  amount: z.coerce.number().min(0.01, "Amount must be positive"),
  isSimulation: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

export function AdminPanel() {
  const [open, setOpen] = useState(false);
  const { mutate: createTransaction, isPending } = useCreateTransaction();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      amount: 100,
      currency: "₺",
      type: "WIN",
      game: "Sweet Bonanza",
      multiplier: "",
      isSimulation: false,
    },
  });

  function onSubmit(values: FormValues) {
    createTransaction(values, {
      onSuccess: () => {
        toast({ title: "Transaction added to the feed." });
        setOpen(false);
        form.reset();
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          data-testid="button-admin-add"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Bet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg">Add Transaction</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 pt-2">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Player123" {...field} data-testid="input-username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Amount (₺)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} data-testid="input-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-type">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="WIN">Win</SelectItem>
                        <SelectItem value="LOSS">Loss</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="game"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Game</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-game">
                          <SelectValue placeholder="Game" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CASINO_GAMES.map(g => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="multiplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Multiplier</FormLabel>
                    <FormControl>
                      <Input placeholder="2.5x" {...field} value={field.value || ""} data-testid="input-multiplier" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="w-full font-semibold"
              disabled={isPending}
              data-testid="button-submit-transaction"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Transaction"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
