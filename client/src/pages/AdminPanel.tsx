import { useState, useEffect } from "react";
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
import { Save, Upload, Shield, Settings, Gamepad2, ScrollText, LogIn, Plus, X, Check, Info, Trash2, AlertTriangle } from "lucide-react";

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

function cleanLadderInput(val: string): string {
  let cleaned = val.trim();
  if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned;
}

function validateLadder(val: string): string | null {
  const cleaned = cleanLadderInput(val);
  if (!cleaned) return null;
  const parts = cleaned.split(",").map(v => v.trim()).filter(v => v !== "");
  const nums = parts.map(v => Number(v));
  if (nums.some(v => isNaN(v) || v <= 0)) return "Tum degerler pozitif sayi olmalidir";
  if (nums.length < 5) return "En az 5 deger girilmelidir";
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] <= nums[i - 1]) return "Degerler kucukten buyuge siralanmalidir";
  }
  return null;
}

function getLadderCount(val: string): number {
  const cleaned = cleanLadderInput(val);
  if (!cleaned) return 0;
  return cleaned.split(",").map(v => v.trim()).filter(v => v !== "" && !isNaN(Number(v))).length;
}

function DeleteConfirmModal({ gameName, onConfirm, onCancel }: { gameName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <Card className="w-full max-w-md mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-md bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold">Bu oyunu silmek istedigine emin misin?</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-1">
          <strong>"{gameName}"</strong> oyunu kalici olarak feed'den kaldirilacak.
        </p>
        <p className="text-xs text-muted-foreground mb-5 bg-muted/40 rounded-md p-2.5">
          Silinen oyun feed'de bir daha gorunmez. Istersen pasif yapmayi da tercih edebilirsin.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} data-testid="button-cancel-delete">
            Iptal
          </Button>
          <Button variant="destructive" onClick={onConfirm} data-testid="button-confirm-delete">
            <Trash2 className="w-4 h-4 mr-1" />
            Sil
          </Button>
        </div>
      </Card>
    </div>
  );
}

function GameRow({ game, onSave, onDelete, isSuperAdmin }: { game: GameConfig; onSave: (gameId: string, updates: Partial<GameConfig>, onSuccess?: () => void) => void; onDelete: (gameId: string) => void; isSuperAdmin: boolean }) {
  const [isActive, setIsActive] = useState(game.isActive);
  const [ladderType, setLadderType] = useState(game.ladderType);
  const [customLadder, setCustomLadder] = useState(game.customLadder || "");
  const [uploading, setUploading] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [imgKey, setImgKey] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsActive(game.isActive);
    setLadderType(game.ladderType);
    setCustomLadder(game.customLadder || "");
    setImgKey(k => k + 1);
  }, [game]);

  const hasChanges = isActive !== game.isActive || ladderType !== game.ladderType || customLadder !== (game.customLadder || "");

  const handleSave = () => {
    if (customLadder.trim()) {
      const err = validateLadder(customLadder);
      if (err) {
        toast({ title: "Hata", description: err, variant: "destructive" });
        return;
      }
    }
    const updates: any = {};
    if (isActive !== game.isActive) updates.isActive = isActive;
    if (ladderType !== game.ladderType) updates.ladderType = ladderType;
    if (customLadder !== (game.customLadder || "")) updates.customLadder = customLadder || null;
    onSave(game.gameId, updates, () => {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 300 * 1024) {
      toast({ title: "Hata", description: "Dosya boyutu 300KB'yi asamaz. Gorseli kucultup tekrar deneyin.", variant: "destructive" });
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message || "Upload failed");
      }
      const result = await res.json();
      if (!result.imagePath) throw new Error("Gorsel kaydedilemedi");

      queryClient.setQueryData<GameConfig[]>(["/api/admin/games"], (old) => {
        if (!old) return old;
        return old.map(g => g.gameId === game.gameId ? { ...g, imagePath: result.imagePath } : g);
      });
      setImgKey(k => k + 1);

      toast({ title: "Basarili", description: "Gorsel guncellendi — canli feed'e yansitildi" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game-images"] });
    } catch {
      toast({ title: "Hata", description: "Gorsel yuklenemedi", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const ladderCount = getLadderCount(customLadder);

  return (
    <div className="grid grid-cols-[60px_1fr_140px_80px_130px_1fr_140px] gap-2 items-center py-3 px-4 border-b border-border/50" data-testid={`game-row-${game.gameId}`}>
      <div className="flex items-center justify-center">
        {game.imagePath ? (
          <img key={imgKey} src={game.imagePath} alt={game.name} className="w-10 h-10 rounded object-cover" data-testid={`game-image-${game.gameId}`} />
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
          <span className="text-[10px] text-muted-foreground">{game.gameId}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="relative cursor-pointer">
          <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={handleImageUpload} disabled={uploading} data-testid={`upload-input-${game.gameId}`} />
          <Button variant="outline" size="sm" disabled={uploading} asChild>
            <span><Upload className="w-3 h-3 mr-1" />{uploading ? "..." : "Upload"}</span>
          </Button>
        </label>
        <span className="text-[8px] text-muted-foreground leading-tight">256x256 PNG/WEBP &lt;300KB</span>
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
        <Input
          value={customLadder}
          onChange={(e) => setCustomLadder(e.target.value)}
          placeholder="1,2,5,10,25... (min 5 deger)"
          className="h-8 text-xs"
          data-testid={`input-custom-ladder-${game.gameId}`}
        />
        {customLadder.trim() && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {ladderCount} deger
            {ladderCount > 0 && ladderCount < 5 && <span className="text-destructive ml-1">(min 5)</span>}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-1.5">
        {justSaved && (
          <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/40">
            <Check className="w-2.5 h-2.5 mr-0.5" />Updated
          </Badge>
        )}
        <Button size="sm" onClick={handleSave} disabled={!hasChanges} data-testid={`save-game-${game.gameId}`}>
          <Save className="w-3 h-3 mr-1" />
          Save
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setShowDeleteConfirm(true)} data-testid={`delete-game-${game.gameId}`}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
      {showDeleteConfirm && (
        <DeleteConfirmModal
          gameName={game.name}
          onConfirm={() => {
            setShowDeleteConfirm(false);
            onDelete(game.gameId);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

function AddGameModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<string>("pragmatic");
  const [slug, setSlug] = useState("");
  const [autoSlug, setAutoSlug] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [ladderType, setLadderType] = useState("default");
  const [customLadder, setCustomLadder] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (autoSlug && name) {
      setSlug(
        name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
      );
    }
  }, [name, autoSlug]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Hata", description: "Oyun adi zorunludur", variant: "destructive" });
      return;
    }
    if (!imageFile) {
      toast({ title: "Hata", description: "Gorsel yuklemek zorunludur", variant: "destructive" });
      return;
    }

    if (customLadder.trim()) {
      const err = validateLadder(customLadder);
      if (err) {
        toast({ title: "Hata", description: err, variant: "destructive" });
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/admin/games", {
        name: name.trim(),
        provider,
        gameId: slug || undefined,
        isActive,
        ladderType,
        customLadder: customLadder.trim() || null,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Olusturulamadi" }));
        throw new Error(err.message);
      }

      const created = await res.json();

      if (imageFile) {
        const buffer = await imageFile.arrayBuffer();
        const imgRes = await fetch(`/api/admin/games/${created.gameId}/image`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: buffer,
          credentials: "include",
        });
        if (!imgRes.ok) {
          toast({ title: "Uyari", description: "Oyun olusturuldu fakat gorsel yuklenemedi. Admin panelden tekrar deneyin." });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game-images"] });
      toast({ title: "Basarili", description: `"${name}" oyunu eklendi` });
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ title: "Hata", description: err.message || "Oyun eklenemedi", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Card className="w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 gap-2">
          <h2 className="text-lg font-semibold">Yeni Oyun Ekle</h2>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-modal">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-sm">Oyun Adi *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ornegin: Lucky Dragons" data-testid="input-new-game-name" />
          </div>

          <div>
            <Label className="text-sm">Provider *</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger data-testid="select-new-game-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pragmatic">Pragmatic Play</SelectItem>
                <SelectItem value="playngo">Play'n GO</SelectItem>
                <SelectItem value="netent">NetEnt</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm">Slug (otomatik / duzenlenebilir)</Label>
            <div className="flex items-center gap-2">
              <Input
                value={slug}
                onChange={(e) => { setAutoSlug(false); setSlug(e.target.value); }}
                placeholder="otomatik-olusturulur"
                className="flex-1"
                data-testid="input-new-game-slug"
              />
              {!autoSlug && (
                <Button size="sm" variant="ghost" onClick={() => setAutoSlug(true)}>
                  Sifirla
                </Button>
              )}
            </div>
          </div>

          <div>
            <Label className="text-sm">Gorsel *</Label>
            <div className="flex items-center gap-3 mt-1">
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="sr-only"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  data-testid="input-new-game-image"
                />
                <Button variant="outline" size="sm" asChild>
                  <span><Upload className="w-3 h-3 mr-1" />Dosya Sec</span>
                </Button>
              </label>
              {imageFile && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{imageFile.name}</span>}
            </div>
            <div className="flex items-start gap-1.5 mt-1.5">
              <Info className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-tight">
                256x256 px | PNG / WEBP | Maks 300 KB | Seffaf arkaplan tercih edilir
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm">Aktif</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="toggle-new-game-active" />
          </div>

          <div>
            <Label className="text-sm">Ladder</Label>
            <Select value={ladderType} onValueChange={setLadderType}>
              <SelectTrigger data-testid="select-new-game-ladder">
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
          </div>

          <div>
            <Label className="text-sm">Custom Ladder (opsiyonel)</Label>
            <Input
              value={customLadder}
              onChange={(e) => setCustomLadder(e.target.value)}
              placeholder="1,2,5,10,25,50,100... (min 5 deger)"
              data-testid="input-new-game-custom-ladder"
            />
            {customLadder.trim() && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {getLadderCount(customLadder)} deger
                {getLadderCount(customLadder) > 0 && getLadderCount(customLadder) < 5 && <span className="text-destructive ml-1">(min 5)</span>}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Iptal
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !name.trim() || !imageFile} data-testid="button-create-game">
              {submitting ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </Card>
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
  const [showAddModal, setShowAddModal] = useState(false);
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
    mutationFn: async ({ gameId, updates, onSuccessCb }: { gameId: string; updates: any; onSuccessCb?: () => void }) => {
      const res = await apiRequest("PUT", `/api/admin/games/${gameId}`, updates);
      const data = await res.json();
      return { data, onSuccessCb };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game-images"] });
      toast({ title: "Basarili", description: "Oyun ayari guncellendi" });
      result.onSuccessCb?.();
    },
    onError: (err: any) => {
      const msg = err?.message || "Guncelleme basarisiz";
      toast({ title: "Hata", description: msg, variant: "destructive" });
    },
  });

  const deleteGameMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/games/${gameId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/game-images"] });
      toast({ title: "Basarili", description: "Oyun silindi" });
    },
    onError: (err: any) => {
      toast({ title: "Hata", description: err?.message || "Silme basarisiz", variant: "destructive" });
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
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Oyun Listesi</h2>
                {games && (
                  <Badge variant="outline" className="text-xs">
                    {games.filter(g => g.isActive).length} aktif / {games.length} toplam
                  </Badge>
                )}
              </div>
              <Button onClick={() => setShowAddModal(true)} data-testid="button-add-game">
                <Plus className="w-4 h-4 mr-1" />
                Yeni Oyun Ekle
              </Button>
            </div>

            <div className="grid grid-cols-[60px_1fr_140px_80px_130px_1fr_140px] gap-2 items-center py-2 px-4 text-xs text-muted-foreground font-medium uppercase tracking-wider border-b border-border">
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
                  onSave={(gameId, updates, onSuccessCb) => updateGameMutation.mutate({ gameId, updates, onSuccessCb })}
                  onDelete={(gameId) => deleteGameMutation.mutate(gameId)}
                  isSuperAdmin={isSuperAdmin}
                />
              ))
            )}

            <div className="mt-4 flex items-start gap-2 px-4 py-3 rounded-md bg-muted/30 border border-border/30">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Gorsel kurallari:</strong> 256x256 px | PNG / WEBP | Maks 300 KB | Seffaf arkaplan tercih edilir</p>
                <p><strong>Custom Ladder:</strong> Virgul ile ayrilmis artan sira pozitif sayilar. Min 5 deger. Koseli parantez kabul edilir: [1,2,5,10,25]</p>
                <p><strong>Custom Ladder doluysa</strong> o oyun icin feed bet uretimi tamamen bu ladder'dan yapilir. Bos ise provider ladder kullanilir.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && isSuperAdmin && settings && (
          <FeedSettingsPanel settings={settings} onSave={(updates) => updateSettingsMutation.mutate(updates)} />
        )}

        {activeTab === "logs" && <AuditLogsPanel />}
      </main>

      {showAddModal && (
        <AddGameModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
          }}
        />
      )}
    </div>
  );
}
