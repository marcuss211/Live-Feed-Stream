# Kurulum Kilavuzu — Casino Live Feed Admin Panel

Bu belge, projeyi sifirdan kurup calistirmak isteyen yazilimcilar icindir.

---

## Gereksinimler

- **Node.js** v20 veya ustu
- **npm** v9 veya ustu
- **PostgreSQL** v14 veya ustu (yerel veya uzak sunucu)

---

## 1. Projeyi Indirme

```bash
# GitHub'dan klonla
git clone <REPO_URL>
cd <PROJE_KLASORU>
```

Veya ZIP dosyasini aciniz ve klasore girin.

---

## 2. Bagimliliklari Yukleme

```bash
npm install
```

---

## 3. Ortam Degiskenleri (Environment Variables)

Proje kokunde `.env` dosyasi olusturun:

```env
DATABASE_URL=postgresql://KULLANICI:SIFRE@HOST:PORT/VERITABANI_ADI
SESSION_SECRET=rastgele-guclu-bir-sifre-buraya-yazin
REPL_ID=herhangi-bir-benzersiz-id
ISSUER_URL=https://replit.com/oidc
```

### Aciklamalar:

| Degisken | Aciklama |
|----------|----------|
| `DATABASE_URL` | PostgreSQL baglanti adresi. Ornek: `postgresql://postgres:sifre123@localhost:5432/casino_feed` |
| `SESSION_SECRET` | Oturum sifreleme anahtari. Rastgele uzun bir metin olmali (en az 32 karakter). |
| `REPL_ID` | Replit ortaminda otomatik gelir. Yerel gelistirmede herhangi bir deger yazabilirsiniz (ornek: `local-dev-1`). |
| `ISSUER_URL` | Replit OIDC kimlik dogrulamasi icin. Replit disinda calistiracaksaniz kendi OIDC saglayicinizi ayarlamaniz gerekir. |

---

## 4. Veritabanini Hazirlama

Oncelikle PostgreSQL'de bir veritabani olusturun:

```bash
# PostgreSQL'e baglanin
psql -U postgres

# Veritabani olusturun
CREATE DATABASE casino_feed;

# Cikis
\q
```

Sonra tablolari olusturmak icin:

```bash
npm run db:push
```

Bu komut Drizzle ORM kullanarak tum tablolari otomatik olusturur:
- `transactions` — Islem kayitlari
- `users` — Kullanici hesaplari
- `sessions` — Oturum verileri
- `game_configs` — Oyun yapilandirmalari
- `feed_settings` — Feed ayarlari
- `audit_logs` — Degisiklik kayitlari

---

## 5. Uygulamayi Baslatma

### Gelistirme Modu (Development)

```bash
npm run dev
```

Uygulama `http://localhost:5000` adresinde baslar. Vite HMR (Hot Module Reload) aktiftir.

### Uretim Modu (Production)

```bash
# Once derleyin
npm run build

# Sonra baslatin
NODE_ENV=production node dist/index.cjs
```

---

## 6. Proje Yapisi

```
/
├── client/                  # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── pages/           # Sayfa bilesenleri
│   │   │   ├── LiveFeed.tsx      # Ana canli feed sayfasi
│   │   │   └── AdminPanel.tsx    # Yonetim paneli
│   │   ├── components/      # Yeniden kullanilabilir bilesenler
│   │   ├── hooks/           # Ozel React hook'lari
│   │   └── lib/             # Yardimci fonksiyonlar
│   └── public/
│       └── images/games/    # Oyun gorselleri (256x256px)
│
├── server/                  # Backend (Express + TypeScript)
│   ├── routes.ts            # API rotalari
│   ├── storage.ts           # Veritabani islemleri (CRUD)
│   ├── db.ts                # PostgreSQL baglantisi
│   ├── gameConfigCache.ts   # Oyun yapilandirma onbellegi
│   └── replit_integrations/ # Kimlik dogrulama (OIDC)
│
├── shared/                  # Ortak kod (Frontend + Backend)
│   ├── schema.ts            # Drizzle tablo tanimlari + Zod semalari
│   └── models/auth.ts       # Kullanici ve oturum tablo tanimlari
│
└── drizzle.config.ts        # Drizzle ORM yapilandirmasi
```

---

## 7. Onemli API Uclari

### Genel
| Metot | Adres | Aciklama |
|-------|-------|----------|
| GET | `/api/transactions` | Islemleri listele (sayfalama destekli) |
| GET | `/api/transactions/stream` | SSE canli akim |
| GET | `/api/stats` | Kar/zarar istatistikleri |

### Admin (Kimlik dogrulama + admin rolu gerekli)
| Metot | Adres | Aciklama |
|-------|-------|----------|
| GET | `/api/admin/me` | Mevcut kullanicinin admin rolunu getir |
| GET | `/api/admin/games` | Tum oyun yapilandirmalarini listele |
| POST | `/api/admin/games` | Yeni oyun olustur |
| PUT | `/api/admin/games/:gameId` | Oyun yapilandirmasini guncelle |
| DELETE | `/api/admin/games/:gameId` | Oyunu sil (soft-delete) |
| POST | `/api/admin/games/:gameId/image` | Oyun gorseli yukle (max 300KB) |
| GET | `/api/admin/settings` | Feed ayarlarini getir |
| PUT | `/api/admin/settings` | Feed ayarlarini guncelle (sadece SuperAdmin) |
| GET | `/api/admin/audit-logs` | Denetim kayitlarini goruntule |
| POST | `/api/admin/promote` | Kullanici rolunu degistir (sadece SuperAdmin) |

---

## 8. Kimlik Dogrulama (Authentication)

Proje Replit OIDC (OpenID Connect) kullanir. Replit disinda calistirmak icin:

1. Kendi OIDC saglayicinizi ayarlayin (ornek: Auth0, Keycloak)
2. `ISSUER_URL` degiskenini kendi saglayicinizin adresine guncelleyin
3. Veya `server/replit_integrations/auth/` klasorundeki kodlari kendi kimlik dogrulama sisteminize uyarlayin

### Roller
- **SuperAdmin** — Tam erisim (feed ayarlari, rol yonetimi dahil)
- **ContentManager** — Oyun yonetimi (ekleme, duzenleme, silme, gorsel yukleme)
- **User** — Admin paneline erisim yok

Ilk giris yapan kullanici otomatik olarak SuperAdmin olur.

---

## 9. Oyun Gorselleri

- Konum: `client/public/images/games/`
- Boyut: 256x256 piksel onerilir
- Format: PNG, JPG veya WebP
- Maksimum dosya boyutu: 300KB
- Admin panelinden yuklenebilir

---

## 10. Onemli Notlar

- Sunucu her 1.5 saniyede bir sahte islem uretir (demo amacli). Gercek veriyle calistirmak icin `server/routes.ts` dosyasindaki `setInterval` blogu kaldirilmalidir.
- Soft-delete: Silinen oyunlar veritabaninda kalir ama `is_deleted=true` olarak isaretlenir ve hicbir yerde gosterilmez.
- Oyun yapilandirma degisiklikleri aninda uygulanir (sunucu yeniden baslatma gerekmez).
- Feed ayarlari (saglayici agirliklari vb.) sadece SuperAdmin tarafindan degistirilebilir.
