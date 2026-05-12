# 📊 Puan Hesaplama Kuralları — Score Rules

> **Bu dosya, sistemdeki tüm puan hesaplama mantığının tek referans noktasıdır.**
> Yeni bir sayfa, bileşen veya rapor oluştururken puan göstermek istiyorsan
> önce bu dosyayı oku, ardından belirtilen fonksiyona git.

---

## 🔑 Tek Kural: Her Zaman `calcAuditScore` Kullan

```ts
import { calcAuditScore } from "@/lib/utils";

const puan = calcAuditScore(audit.sections, audit.totalScore);
```

Bu kadar. Başka bir şey yapmana gerek yok.

---

## 📍 Fonksiyon Konumu

| Fonksiyon | Dosya | Satır |
|-----------|-------|-------|
| `calcAuditScore` | `lib/utils.ts` | ~70 |
| `_applyRule` (iç) | `lib/utils.ts` | ~9 (private) |

---

## ⚙️ Algoritma B — Nasıl Çalışır?

Sistem **Algoritma B** (Bölüm Ortalaması) kullanır.

```
Her bölüm için:
  bölüm_yüzdesi = (kazanılan_puan / maksimum_puan) × 100

Final puan:
  avg = bölüm_yüzdelerinin aritmetik ortalaması
  final = _applyRule(avg)
```

### Örnek

| Bölüm | Kazanılan | Maks | Yüzde |
|-------|-----------|------|-------|
| Hijyen | 18 | 20 | %90 |
| Servis | 27 | 30 | %90 |
| Ürün | 46 | 50 | %92 |

```
avg = (90 + 90 + 92) / 3 = 90.67  →  final = 91
```

---

## 📏 Gösterim Kuralı (99 Kuralı)

`_applyRule` fonksiyonu `calcAuditScore` içinde otomatik uygulanır,
ayrıca çağrılması **gerekmez**.

| Ham Puan | Gösterilen |
|----------|-----------|
| 99.1 – 99.9 | **99** |
| 98.5 | **99** (Math.round) |
| 100.0 | **100** |
| 91.4 | **91** |

> **Neden?** Ham puan 100 olmadan "100" gösterilmesi engellenir.
> Mağaza ancak gerçekten tüm soruları tam puan alırsa 100 görür.

---

## 🚫 Yapılmaması Gerekenler

```ts
// ❌ YANLIŞ — stale Firestore değeri
const puan = audit.totalScore;

// ❌ YANLIŞ — manuel döngü
const puan = sections.reduce(...) / sections.length;

// ❌ YANLIŞ — applyScoreRule'u ayrıca çağırma
const puan = applyScoreRule(calcAuditScore(...));  // çift uygulama!

// ✅ DOĞRU
const puan = calcAuditScore(audit.sections, audit.totalScore);
```

---

## 🧩 Muaf (Exempt) Sorular

`answer === "muaf"` veya `answer === ""` olan sorular hesaba **katılmaz**.
Sadece cevaplanmış (evet/hayır/puan verilmiş) sorular dikkate alınır.

---

## 📦 Bağımlı Dosyalar

Aşağıdaki dosyalar `calcAuditScore` kullanmaktadır:

| Dosya | Açıklama |
|-------|----------|
| `app/audits/[id]/page.tsx` | Denetim detay sayfası başlık puanı |
| `app/admin/dashboard/page.tsx` | Admin paneli tablo puanı |
| `components/audit-summary.tsx` | Denetim özet kartı + PDF |
| `components/regional-manager/regional-dashboard.tsx` | Bölge paneli liste & aylık ortalama |
| `components/report-manager/report-panel-dashboard.tsx` | Rapor paneli tablo puanı |
| `components/auditor/store-analysis-dialog.tsx` | Mağaza analiz diyaloğu geçmiş puanlar |
| `lib/store-analysis.ts` | Son denetim puanı hesabı (`lastScore`) |
| `hooks/use-store-data.ts` | Mağaza hook fallback puanı |

---

## 🔧 Formülü veya Kuralı Değiştirmek İstersen

1. `lib/utils.ts` dosyasını aç
2. `calcAuditScore` fonksiyonunu bul (~satır 70)
3. **Formülü** değiştirmek istersen → `sectionScores` hesabını düzenle
4. **99 kuralını** değiştirmek istersen → `_applyRule` fonksiyonunu düzenle
5. Başka hiçbir dosyaya dokunmana gerek yok — değişiklik tüm sisteme otomatik yansır

---

## 📅 Son Güncelleme

- **2026-05-12** — `calcAuditScore` merkezi fonksiyon olarak tanımlandı,
  tüm bileşenler bu fonksiyona migre edildi.
  `applyScoreRule` `@deprecated` olarak işaretlendi.
