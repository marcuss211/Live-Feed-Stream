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

// Frontend validation schema can be slightly more permissive or strict than backend
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
      game: "Roulette",
      multiplier: "2x",
      isSimulation: false,
    },
  });

  function onSubmit(values: FormValues) {
    createTransaction(values, {
      onSuccess: () => {
        toast({
          title: "Transaction Created",
          description: "Successfully added new transaction to the feed.",
        });
        setOpen(false);
        form.reset();
      },
      onError: (err) => {
        toast({
          title: "Error",
          description: err.message,
          variant: "destructive",
        });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 bg-card/50 backdrop-blur-md border-white/10 hover:bg-white/5 hover:text-white transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Manual Entry</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-white/10 text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Add Transaction</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Player123" {...field} className="bg-background/50 border-white/10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} className="bg-background/50 border-white/10" />
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
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background/50 border-white/10">
                          <SelectValue placeholder="Select type" />
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="game"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Game</FormLabel>
                    <FormControl>
                      <Input placeholder="Blackjack" {...field} className="bg-background/50 border-white/10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="multiplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Multiplier (Opt)</FormLabel>
                    <FormControl>
                      <Input placeholder="2x" {...field} value={field.value || ""} className="bg-background/50 border-white/10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
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
