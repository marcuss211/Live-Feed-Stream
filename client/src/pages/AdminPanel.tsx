import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, Upload, Shield, Settings, Gamepad2, ScrollText, LogIn } from "lucide-react";

interface GameConfig {
  id: number;
  gameId: string;
  name: string;
  provider: string;
  imagePath: string | null;
  isActive: boolean;
  ladderType: string;
  customLadder: string | null;
}

interface AdminMe {
  userId: string;
  role: string;
}

interface AuditLog {
  id: number;
  adminUserId: string;
  adminEmail: string | null;
  entity: string;
  entityId: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  timestamp: string;
}

type Tab = "games" | "settings" | "logs";

function GameRow({ game, onSave, isSuperAdmin }: { game: GameConfig; onSave: (gameId: string, updates: Partial<GameConfig>) => void; isSuperAdmin: boolean }) {
  const [isActive, setIsActive] = useState(game.isActive);
  const [ladderType, setLadderType] = useState(game.ladderType);
  const [customLadder, setCustomLadder] = useState(game.customLadder || "");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const hasChanges = isActive !== game.isActive || ladderType !== game.ladderType || customLadder !== (game.customLadder || "");

  const handleSave = () => {
    const updates: any = {};
    if (isActive !== game.isActive) updates.isActive = isActive;
    if (ladderType !== game.ladderType) updates.ladderType = ladderType;
    if (customLadder !== (game.customLadder || "")) updates.customLadder = customLadder || null;
    onSave(game.gameId, updates);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Hata", description: "Dosya boyutu 5MB'yi asamaz", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch(`/api/admin/games/${game.gameId}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: buffer,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      toast({ title: "Basarili", description: "Gorsel guncellendi" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
    } catch {
      toast({ title: "Hata", description: "Gorsel yuklenemedi", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid grid-cols-[60px_1fr_120px_100px_140px_1fr_80px] gap-3 items-center py-3 px-4 border-b border-border/50" data-testid={`game-row-${game.gameId}`}>
      <div className="flex items-center justify-center">
        {game.imagePath ? (
          <img src={game.imagePath} alt={game.name} className="w-10 h-10 rounded object-cover" data-testid={`game-image-${game.gameId}`} />
        ) : (
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
            <Gamepad2 className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="font-medium text-sm truncate" data-testid={`game-name-${game.gameId}`}>{game.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-xs">{game.provider}</Badge>
          <span className="text-xs text-muted-foreground">{game.gameId}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="relative cursor-pointer">
          <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={handleImageUpload} disabled={uploading} data-testid={`upload-input-${game.gameId}`} />
          <Button variant="outline" size="sm" disabled={uploading} asChild>
            <span><Upload className="w-3 h-3 mr-1" />{uploading ? "..." : "Upload"}</span>
          </Button>
        </label>
      </div>

      <div className="flex items-center justify-center">
        <Switch checked={isActive} onCheckedChange={setIsActive} data-testid={`toggle-active-${game.gameId}`} />
      </div>

      <Select value={ladderType} onValueChange={setLadderType}>
        <SelectTrigger className="h-8 text-xs" data-testid={`select-ladder-${game.gameId}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Default</SelectItem>
          <SelectItem value="pragmatic">Pragmatic</SelectItem>
          <SelectItem value="playngo">Play'n GO</SelectItem>
          <SelectItem value="netent">NetEnt</SelectItem>
          <SelectItem value="hacksaw">Hacksaw</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>

      <div className="min-w-0">
        {ladderType === "custom" && (
          <Input
            value={customLadder}
            onChange={(e) => setCustomLadder(e.target.value)}
            placeholder="1,2,5,10,25,50,100..."
            className="h-8 text-xs"
            data-testid={`input-custom-ladder-${game.gameId}`}
          />
        )}
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={!hasChanges} data-testid={`save-game-${game.gameId}`}>
          <Save className="w-3 h-3 mr-1" />
          Save
        </Button>
      </div>
    </div>
  );
}

function FeedSettingsPanel({ settings, onSave }: { settings: Record<string, string>; onSave: (updates: Record<string, string>) => void }) {
  const [pragWeight, setPragWeight] = useState(settings.provider_weight_pragmatic || "70");
  const [playngoWeight, setPlayngoWeight] = useState(settings.provider_weight_playngo || "15");
  const [netentWeight, setNetentWeight] = useState(settings.provider_weight_netent || "8");
  const [otherWeight, setOtherWeight] = useState(settings.provider_weight_other || "7");

  const handleSave = () => {
    onSave({
      provider_weight_pragmatic: pragWeight,
      provider_weight_playngo: playngoWeight,
      provider_weight_netent: netentWeight,
      provider_weight_other: otherWeight,
    });
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Provider Agirliklari</h3>
      <div className="grid grid-cols-2 gap-4 max-w-lg">
        <div>
          <Label className="text-xs text-muted-foreground">Pragmatic Play (%)</Label>
          <Input value={pragWeight} onChange={(e) => setPragWeight(e.target.value)} data-testid="input-weight-pragmatic" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Play'n GO (%)</Label>
          <Input value={playngoWeight} onChange={(e) => setPlayngoWeight(e.target.value)} data-testid="input-weight-playngo" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">NetEnt (%)</Label>
          <Input value={netentWeight} onChange={(e) => setNetentWeight(e.target.value)} data-testid="input-weight-netent" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Other (%)</Label>
          <Input value={otherWeight} onChange={(e) => setOtherWeight(e.target.value)} data-testid="input-weight-other" />
        </div>
      </div>
      <Button className="mt-4" onClick={handleSave} data-testid="save-settings">
        <Save className="w-4 h-4 mr-2" />
        Ayarlari Kaydet
      </Button>
    </Card>
  );
}

function AuditLogsPanel() {
  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
  });

  if (isLoading) return <div className="p-4 text-muted-foreground">Yukleniyor...</div>;

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-4">Degisiklik Gecmisi</h3>
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {logs && logs.length > 0 ? logs.map((log) => (
          <div key={log.id} className="flex items-start gap-3 py-2 border-b border-border/30 text-sm" data-testid={`audit-log-${log.id}`}>
            <div className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
              {new Date(log.timestamp).toLocaleString("tr-TR")}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-muted-foreground">{log.adminEmail || log.adminUserId}</span>
              {" — "}
              <span className="font-medium">{log.entity}</span>
              {log.entityId && <span className="text-muted-foreground"> ({log.entityId})</span>}
              {" — "}
              <span className="text-muted-foreground">{log.field}:</span>
              {" "}
              {log.oldValue && <span className="line-through text-destructive/70 mr-1">{log.oldValue.substring(0, 40)}</span>}
              <span className="text-green-500">{log.newValue?.substring(0, 40)}</span>
            </div>
          </div>
        )) : (
          <p className="text-muted-foreground text-sm">Henuz degisiklik kaydedilmemis.</p>
        )}
      </div>
    </Card>
  );
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("games");
  const { toast } = useToast();

  const { data: adminMe, isLoading: adminLoading } = useQuery<AdminMe | null>({
    queryKey: ["/api/admin/me"],
    queryFn: async () => {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: games, isLoading: gamesLoading } = useQuery<GameConfig[]>({
    queryKey: ["/api/admin/games"],
    enabled: !!adminMe && (adminMe.role === "super_admin" || adminMe.role === "content_manager"),
  });

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/settings"],
    enabled: !!adminMe && adminMe.role === "super_admin",
  });

  const updateGameMutation = useMutation({
    mutationFn: async ({ gameId, updates }: { gameId: string; updates: any }) => {
      const res = await apiRequest("PUT", `/api/admin/games/${gameId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      toast({ title: "Basarili", description: "Oyun ayari guncellendi" });
    },
    onError: () => {
      toast({ title: "Hata", description: "Guncelleme basarisiz", variant: "destructive" });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const res = await apiRequest("PUT", "/api/admin/settings", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Basarili", description: "Ayarlar guncellendi" });
    },
    onError: () => {
      toast({ title: "Hata", description: "Ayar guncellemesi basarisiz", variant: "destructive" });
    },
  });

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Yukleniyor...</p>
      </div>
    );
  }

  if (!adminMe || (adminMe.role !== "super_admin" && adminMe.role !== "content_manager")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Admin Paneli</h2>
          <p className="text-muted-foreground mb-4">Bu sayfaya erismek icin yetkiniz bulunmamaktadir. Lutfen giris yapin veya yetki talep edin.</p>
          <a href="/api/login" data-testid="admin-login-btn">
            <Button>
              <LogIn className="w-4 h-4 mr-2" />
              Giris Yap
            </Button>
          </a>
        </Card>
      </div>
    );
  }

  const isSuperAdmin = adminMe.role === "super_admin";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Feed Yonetim Paneli</h1>
            <Badge variant="outline" className="text-xs">{isSuperAdmin ? "SuperAdmin" : "ContentManager"}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "games" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("games")}
              data-testid="tab-games"
            >
              <Gamepad2 className="w-4 h-4 mr-1" />
              Oyunlar
            </Button>
            {isSuperAdmin && (
              <Button
                variant={activeTab === "settings" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("settings")}
                data-testid="tab-settings"
              >
                <Settings className="w-4 h-4 mr-1" />
                Ayarlar
              </Button>
            )}
            <Button
              variant={activeTab === "logs" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("logs")}
              data-testid="tab-logs"
            >
              <ScrollText className="w-4 h-4 mr-1" />
              Loglar
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-[1400px] mx-auto">
        {activeTab === "games" && (
          <div>
            <div className="grid grid-cols-[60px_1fr_120px_100px_140px_1fr_80px] gap-3 items-center py-2 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider border-b border-border">
              <span>Gorsel</span>
              <span>Oyun</span>
              <span>Gorsel Yuk.</span>
              <span className="text-center">Aktif</span>
              <span>Ladder</span>
              <span>Custom Ladder</span>
              <span className="text-right">Islem</span>
            </div>
            {gamesLoading ? (
              <div className="py-8 text-center text-muted-foreground">Yukleniyor...</div>
            ) : (
              games?.map((game) => (
                <GameRow
                  key={game.gameId}
                  game={game}
                  onSave={(gameId, updates) => updateGameMutation.mutate({ gameId, updates })}
                  isSuperAdmin={isSuperAdmin}
                />
              ))
            )}
          </div>
        )}

        {activeTab === "settings" && isSuperAdmin && settings && (
          <FeedSettingsPanel settings={settings} onSave={(updates) => updateSettingsMutation.mutate(updates)} />
        )}

        {activeTab === "logs" && <AuditLogsPanel />}
      </main>
    </div>
  );
}
