# 🤖 Yapay Zeka Haftalık Program Kuralları

> Bu dosya, AuditPro'nun rota bazlı otomatik haftalık program oluşturucusunun tüm karar mantığını tanımlar.
> İleride kural eklemek veya güncellemek için bu dosyayı düzenleyin.

---

## 1. Denetim İhlal Kuralları (Ön Filtre + Doğrulama)

Bu kurallar **iki aşamada** uygulanır:
- **Ön filtre:** Algoritma program oluştururken bu kuralları ihlal eden mağazalara slot **atamaz**.
- **Doğrulama:** Manuel planlama sırasında schedule sayfası (`getViolation()`) bu kuralları kontrol eder; ihlaller kırmızı uyarı olarak gösterilir.

---

### 1.1 — 12 Gün Kuralı

| Alan | Değer |
|------|-------|
| **Kural** | Son denetim tarihinden (tamamlanan veya planlanmış) itibaren en az **12 gün** geçmiş olmalıdır. |
| **Referans tarihi** | Planlanan haftanın **Pazartesi günü** (bugünün tarihi değil). |
| **Kapsam** | Tamamlanmış (`tamamlandi`) denetimler + aktif taslak schedule kayıtları dahildir. |
| **İhlal mesajı** | `"12 Gün Kuralı İhlali! (En yakın: DD.MM.YYYY)"` |
| **Kod konumu** | `schedule/page.tsx → getViolation() → "3. 12-Day Rule Check"` |

**Örnek:**
- Mağaza son 2 Mayıs'ta denetlendi → 14 Mayıs Pazartesi itibarıyla 12 gün dolmuş → ✅ Uygun
- Mağaza son 5 Mayıs'ta denetlendi → 14 Mayıs itibarıyla yalnızca 9 gün → ❌ Bloke

---

### 1.2 — Aylık Maks. 2 Denetim Limiti

| Alan | Değer |
|------|-------|
| **Kural** | Bir mağaza takvim ayı içinde en fazla **2 kez** denetlenebilir. |
| **Sayıma dahil** | Aynı ay içinde tamamlanan (`tamamlandi`) denetimler + taslak (`draft`) schedule kayıtları. |
| **Sayıma dahil değil** | `published` (yayınlanmış) schedule kayıtları — bunlar zaten tamamlanmış denetim olarak sayılır. |
| **Çift sayım önlemi** | Yayınlanmış plan → denetim koleksiyonuna `tamamlandi` olarak geçer; taslak plan ayrıca sayılmaz. |
| **İhlal mesajı** | `"Ayda en fazla 2 denetim limiti aşıldı!"` + detaylı liste |
| **Kod konumu** | `schedule/page.tsx → getViolation() → "2. Frequency Limit Check"` |

---

### 1.3 — Aynı Hafta Çift Denetim Yasağı

| Alan | Değer |
|------|-------|
| **Kural** | Aynı mağaza bir takvim haftası içinde **birden fazla** schedule satırına eklenemez. |
| **Kapsam** | Hafta: Pazartesi 00:00 – Pazar 23:59 (ISO hafta, weekStartsOn: 1). |
| **İhlal mesajı** | `"Bu mağaza bu hafta zaten planlanmış!"` |
| **Kod konumu** | `schedule/page.tsx → getViolation() → "1. Same Week Duplicate Check"` |

> **Not:** 12 Gün Kuralı bu durumu zaten önler; aynı hafta içinde ikinci ziyaret hiçbir zaman 12 günü dolduramaz. Bu kural, 12 gün kuralı geçilen edge case'leri (hata/manuel düzenleme) yakalar.

---

### 1.4 — Sevkiyat Günü İhlali

| Alan | Değer |
|------|-------|
| **Kural** | Mağazanın sevkiyat saatine göre denetim günü kısıtlanır. |
| **Veri kaynağı** | `stores/{id}.shipmentDay` (gün adı, TR) + `stores/{id}.shipmentTime` (HH:MM formatı) |
| **Senaryo A — Gece sevkiyatı (≥ 18:00)** | Sevkiyat **akşam/gece** yapıldıysa ertesi sabah mağaza yoğun olur. → Sevkiyat gününün **ertesi günü** denetim önerilmez. |
| **Senaryo B — Gündüz sevkiyatı (< 18:00)** | Sevkiyat **gün içi** yapıldıysa o gün boyunca mağaza yoğun olur. → Sevkiyat **aynı günü** denetim önerilmez. |
| **Algoritma davranışı** | **HARD BLOCK** — Çakışan güne atama yapılmaz (`return false`). O mağaza o gün için atlanır; algoritma başka bir güne veya başka bir mağazaya geçer. |
| **İhlal mesajı** | `"Dün HH:MM sevkiyatı — mağaza yoğun"` veya `"Bugün HH:MM sevkiyatı — mağaza yoğun"` — yalnızca manuel schedule sayfasında gösterilir. |
| **Kod konumu** | `schedule/page.tsx → getViolation() → "4. Shipment Day Check"` + `ai-schedule-dialog.tsx → tryAssign()` |

**Gün normalizasyonu:** Türkçe karakter duyarsız karşılaştırma (ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c).

---

### 1.5 — Boş Gün Yasağı (Yayın Öncesi Kontrol)

| Alan | Değer |
|------|-------|
| **Kural** | Bir haftalık plan yayınlanmadan önce, tüm denetmenlerin Pazartesi–Cuma günleri **dolu** olmalıdır. |
| **Kapsam** | Herhangi bir atama türü kabul edilir: denetim, izin, tatil (boş = ihlal). |
| **Kontrol zamanı** | Yalnızca `publish` aksiyonunda çalışır; taslak durumunda uyarı üretilmez. |
| **İhlal mesajı** | `"Ad Soyad: DD MMMM (Gün Adı) için hiçbir atama yapılmamış."` |
| **AI algoritması** | 3 kademeli fallback ile 5/5 gün doldurmayı garanti eder (bkz. §7). |
| **Kod konumu** | `schedule/page.tsx → handleTogglePublish() → "2. Empty Day Check"` |

---

### 1.6 — Akıllı Öneri Sistemi (Gün Sayısı & Öncelik Kuralları)

> **Kod konumu:** `schedule/page.tsx → useEffect([stores, audits, schedule, currentDate]) → suggestions hesaplaması`

#### 1.6.1 — Planlama Referans Tarihi (`planningAnchor`)

| Senaryo | Referans Tarihi |
|---------|-----------------|
| Şu anki veya geçmiş haftayı görüntülüyorsun | **Sonraki haftanın Pazartesi** günü |
| Gelecek bir haftayı görüntülüyorsun | O haftanın **Pazartesi** günü |

> **Kritik kural:** 12 gün hesaplaması **bugünden değil, planningAnchor'dan** (planlanacak haftanın Pazartesi'sinden) yapılır. Böylece "gelecek hafta için plan yaparken kaç gün geçmiş olacak?" sorusu doğru yanıtlanır.

---

#### 1.6.2 — Kategori 1: Aylık Eksik Birinci Denetimler (`monthlyMissing`)

Bir mağaza bu listeye girmek için **tüm** şartları sağlamalıdır:

| Şart | Değer |
|------|-------|
| `newReady` listesinde **değil** | Açılış tarihi 20 günden yeni mağazalar hariç |
| Bu ay hiç denetlenmemiş | `audits` koleksiyonunda bu ay kaydı yok |
| Bu ay planlanmamış | `schedule` koleksiyonunda bu ay kaydı yok |
| 12 gün kuralı geçiyor | `planningAnchor - lastInteraction ≥ 12 gün` |

**`lastInteraction` hesabı:** `max(son audit tarihi, son schedule tarihi)` — hangisi daha yeniyse o alınır.

**Sıralama:** Mağaza adına göre alfabetik (A→Z, Türkçe yerel).

---

#### 1.6.3 — Kategori 2: Yeni Açılan Hazır Mağazalar (`newReady`)

| Şart | Değer |
|------|-------|
| `openingDate` tanımlı | Firestore'da `stores/{id}.openingDate` alanı dolu |
| Açılış tarihi | **20 gün veya daha önce** (yani en az 20 gün geçmiş) |
| Hiç denetlenmemiş | `audits` koleksiyonunda kaydı yok |
| Planlanmamış | `schedule` koleksiyonunda kaydı yok |

**Sıralama:** Mağaza adına göre alfabetik.

---

#### 1.6.4 — Kategori 3: Yeniden Denetim Adayları (`reAuditCandidates`)

Bu ay **1 kez** denetlenmiş/planlanmış, ancak henüz 2. denetimi yapılmamış mağazalar:

| Şart | Değer |
|------|-------|
| Bu ay toplam etkileşim | `= 1` (0 ise `monthlyMissing`'e gider; ≥ 2 ise limit dolmuş) |
| 12 gün kuralı | `planningAnchor - lastInteraction ≥ 12 gün` |

**`totalInteractions`** = bu aydaki `audits` sayısı + bu aydaki `schedule` satırı sayısı.

**Sıralama:** En çok gün geçen önce → eşitlikte en düşük skor önce.

---

#### 1.6.5 — Kapasite Hesabı & Kırpma

```
totalCapacity = denetmen_sayısı × 5 (Pazartesi–Cuma)

firstAuditPool   = monthlyMissing ∪ newReady
remainingSlots   = max(0, totalCapacity - firstAuditPool.length)
reAuditCandidates = reAuditCandidates.slice(0, remainingSlots)
```

> Birinci denetimler kapasiteyi doldurursa, ikinci denetim adayları **kesilir** (`slice`). Bu, birinci denetimlerin her zaman önce gelmesini garanti eder.

---

#### 1.6.6 — Akıllı Öneri Tabloda Gösterim Sırası

```
1. monthlyMissing  (Hedef — mavi badge)   → Alfabetik
2. newReady        (Yeni — yeşil badge)   → Alfabetik
3. reAuditCandidates (Tekrar — mor badge) → En çok gün geçen önce
```

**`daysSince` göstergesi:** `getStoreAuditInfo()` fonksiyonu, tablodaki her satırda "kaç gün önce denetlendi" bilgisini göstermek için `planningAnchor - lastAudit.createdAt` hesaplar.

---


## 2. Mağaza Önceliklendirme Sırası

Programa alınacak mağazalar **her denetmen için bağımsız** şu sırayla önceliklendirilir:

1. **Eve yakınlık (birincil kriter)** — Denetmenin ev koordinatına (homeLat/homeLng) yol mesafesi ile sıralanır. En yakın mağaza her zaman önce gelir.
2. **Birinci denetimler önce** — Eşit veya yakın mesafedeki mağazalar arasında: o ay henüz hiç denetlenmemiş mağazalar önceliklidir.
3. **150 km sınırı (yol mesafesi) — Pazartesi** — Pzt günleri maks. 150 km **yol mesafesi** (≠ kuş uçuşu). Hesaplama: haversine × 1.3 faktör. 150 km yol ≈ 115 km haversine.
4. **250 km sınırı (yol mesafesi) — Cuma** — Cum günleri maks. 250 km **yol mesafesi**. Denetmen akşam evine dönebilsin diye Pzt'den daha esnek ama ücret sınırlıdır. Sal–Per günleri bu sınırlar aşılabilir.
5. **Düşük skor** — Eşit kriterler arasında daha düşük ortalama audit skoru olan mağazalar önce alınır.
6. **İkinci denetimler** — Tüm birinci denetimler işlendikten sonra kalan kapasite ikinci denetimlere kullanılır (yine yakından uzağa).

> **Kritik fark:** Algoritma artık "global pair sort" yapmaz. Her denetmen için ayrı bir liste oluşturulur ve o denetmenin evine göre yakından uzağa sıralanır.


---

## 3. Denetmen Kapasitesi

| Parametre | Değer |
|-----------|-------|
| **Günlük varsayılan denetim** | **1 mağaza/denetmen/gün** |
| **İkili denetim istisnası** | 2 mağaza/denetmen/gün — yalnızca **onaylı Migros çift listesindeki** mağazalar için geçerlidir |
| **Haftalık çalışma günleri** | Pazartesi – Cuma (5 gün) |
| **Haftalık kapasite (tek denetmen)** | ~5 mağaza (pratikte 4–5 arasında olur) |
| **Gün doluluk zorunluluğu** | Denetmenin **tüm çalışma günleri** dolu olmalıdır |
| **Pazartesi mesafe sınırı** | ≤ **150 km** yol mesafesi (evden çıkış) |
| **Cuma mesafe sınırı** | ≤ **250 km** yol mesafesi (eve dönüş) |

> **Kural 1 — Şube:** Bir günde **sadece 1 şube** denetlenebilir. Şubeler asla çift atanamaz.
> **Kural 2 — Migros çifti:** Yalnızca §10'daki Onaylı İkili Çiftler listesindeki Migros mağazaları aynı güne atanabilir (zorunlu değil, uygunsa atanır).
> **Kural 3 — Günler dolu olmalı:** Algoritma her denetmenin 5 günün tamamını mağaza ile doldurmaya çalışır.

---

## 4. Rota Mantığı — Ev Merkezli Halka Sistemi

Her denetmen için rota şu prensibe göre oluşturulur:

```
Ev → En yakın mağaza → Orta mesafe mağazalar → Uzak bölge (lojman) → … → Eve dönüş
```

### 4.1 Günlük Rota Kuralları
- Aynı gün ziyaret edilecek 2 mağaza birbirine **≤ 200 km** yol mesafesinde olmalıdır.
- İkinci mağaza, birinci mağazanın yakın çevresinde (aynı bölge) seçilir.
- Gün sonunda bir sonraki güne ait mağazaların konumuna bakılır; eğer uzakta ise en yakın lojmana geçiş önerilir.

### 4.1.1 Ardışık Gün Geçiş Mesafesi (Kritik Kural)

| Alan | Değer |
|------|-------|
| **Kural** | Önceki günün son mağazasından bir sonraki günün mağazasına **yol mesafesi ≤ 200 km** olmalıdır. |
| **Algoritma davranışı** | **HARD BLOCK** — Geçiş mesafesi aşılıyorsa o gün atlanır; uygun bir başka gün aranır. |
| **Kod sabiti** | `MAX_CONSECUTIVE_ROAD = 200` km (`ai-schedule-dialog.tsx`) |
| **Referans** | `auditorDayLoc[auditorId][prevDayName]` → önceki günün son konumu |

**Örnek — Neden gerekli:**
- Salı: Mustafa Bey → Denizli Migros (~200 km kuzeyde)
- Çarşamba: Bodrum Yalıkavak (~250 km güneybatı) → Denizli'den Bodrum = ~300 km yol → **BLOKE**
- Algoritma Bodrum'u Salı veya Perşembe'ye kaydırır; Çarşamba için Denizli'ye yakın bir mağaza arar.

**Geçiş zinciri:**
```
Ev (Pzt) → Mağaza-A → [önceki konum = Mağaza-A] → Mağaza-B (Sal, ≤200km Mağaza-A'dan)
         → [önceki konum = Mağaza-B] → Mağaza-C (Çar, ≤200km Mağaza-B'den) → ...
```


### 4.2 Hafta Başı ve Sonu (Ev-Bağlantılı Günler)
- **Pazartesi:** Denetmen evinden yola çıkar → Eve yakın mağazalar (yol mesafesi ≤ **150 km**).
- **Cuma:** Denetmen iş tamamlayıp **eve döner — lojmanda kalmaz.**
  - Cuma mağazası yol mesafesi ≤ **250 km** olmalıdır (akşam evine ulaşabilsin).
  - Pazartesi'den daha esnek tutuldu çünkü denetmen hafta içi konaklamadan buraya gelebilir.
  - Algoritma Cuma slotuna hiçbir koşulda konaklama bilgisi üretmez; **"🏠 Eve dönüş"** notu gösterilir.
- **Önemli:** Yol mesafesi = haversine × 1.3 faktör (150 km yol ≈ 115 km haversine).

### 4.3 Bölge Sıralaması (Genel Prensipler)
- Eve yakın bölgeler haftanın **başında veya sonunda** planlanır.
- Uzak bölgeler haftanın **ortasında (Salı–Perşembe)** planlanır.
- Aynı şehirde birden fazla mağaza varsa aynı güne ya da ardışık günlere atanır.

---

## 5. Konaklama (Lojman) Kararı

### 5.1 Konaklama Karar Ağacı

Her atama tamamlandığında algoritma şu sırayla karar verir:

| Öncelik | Koşul | Sonuç |
|---------|-------|-------|
| 1 | Gün = **Cuma** | 🏠 **Eve dönüş** — lojman önerilmez |
| 2 | Mağazadan eve yol mesafesi **≤ 80 km** | 🏠 **Eve dönüş** — lojman önerilmez |
| 3 | Mağazadan eve yol mesafesi **> 80 km** | 🏨 **En yakın lojman** önerilir |
| 4 | Yakın lojman bulunamazsa | ⚠️ "Lojman tanımlı değil" uyarısı |

> **Kod sabiti:** `LOJMAN_ROAD_LIMIT = 80 km` (`ai-schedule-dialog.tsx`)
> **Hesaplama:** haversine × 1.3 faktör = tahmini yol km.

---

### 5.2 Kendi Bölgesindeki Mağaza Kuralı (Ev Dönüşü)

**Durum:** Denetmen kendi şehrinde/yakın çevresinde denetim yapıyor.

**Örnek — Mustafa Bey (Denizli'de oturuyor):**
```
Pazartesi → Denizli-1 Mağazası (~1 km)   → 🏠 Eve dönüş (konaklama YOK)
Salı      → Denizli-2 Mağazası (~1 km)   → 🏠 Eve dönüş (konaklama YOK)
Çarşamba  → Bodrum Migros (~250 km yol)  → 🏨 Marmaris Lojmanı önerilir
```

**Neden önemli:**
- Denizli mağazaları ≤80 km kısıtı içinde → denetmen her gece evine döner.
- Lojman önerisi yalnızca gerçek anlamda "uzak" günler için gösterilir.
- UI'da "Eve dönüş" notu her iki durumda da açıkça yazılır — boş bırakılmaz.

---

### 5.3 Lojman Seçim Kuralı
- Lojman, gece konaklama ihtiyacı olan konuma (mağaza veya bir sonraki gün güzergahı) en yakın **kayıtlı lojman** seçilir.
- Lojman koordinatları `/admin/schedule/lojmanlar` sayfasından yönetilir (Firestore: `lodging_locations`).
- Kayıtlı lojman yoksa şehir adıyla genel bir konaklama notu eklenir ve kullanıcı lojman eklemeye yönlendirilir.

### 5.4 Lojman Verisi Formatı (Firestore)
```
lodging_locations/{id}
  name: string        // "İzmir Lojmanı"
  city: string        // "İzmir"
  lat: number         // 38.4192
  lng: number         // 27.1287
  capacity?: number   // 4
  notes?: string
```

---

## 6. Denetmenler Arası Koordinasyon

> Bu bir öneri motorudur; denetmenler **mutlaka** birlikte hareket etmek zorunda değildir.
> Denetim kriterleri her denetmen için bağımsız işletilir.

### 6.1 Ortak Lojman Tespiti
- Aynı gece aynı lojmanda kalan 2+ denetmen varsa tabloda **"Ortak Konaklama"** rozeti gösterilir.
- Bu durum, ertesi sabah aynı noktadan yola çıkarak yakın bölgelerdeki mağazaları birlikte denetleme
  (paylaşmalı araç) fırsatı doğurur.

### 6.2 Bölgesel Kümeleme
- Aynı ilde veya 50 km yarıçapında birden fazla denetmen göreve atanmışsa, aynı güne planlanmaları
  yerine **ardışık günlere** dağıtılır (yük dengeleme).
- İstisna: Aynı şehirde çok sayıda mağaza varsa (≥ 3) birden fazla denetmen aynı gün atanabilir.

---

## 7. Algoritma Akışı (Özet)

```
1. Ön Filtre
   ├── 12 gün kuralı kontrolü (planningAnchor = sonraki Pazartesi)
   └── Aylık limit (≤ 2) kontrolü

2. Her (mağaza, denetmen) çifti için skor hesapla
   ├── distanceFromHome = haversine(homeLat, homeLng, storeLat, storeLng)
   ├── isBranchStore = mağaza adında "Migros" geçmiyor mu? → Şube
   └── isFirstVisit = bu ay hiç denetlenmemiş mi?

3. GEÇİŞ 1 — Sadece Birinci Denetimler (Global Öncelik)
   ├── Tüm denetmenler için yalnızca "birinci denetim" mağazaları işlenir
   ├── Pazartesi ve Cuma: eve yakın mağazalar (≤ 150 km)
   ├── Salı–Perşembe: uzak bölgeler (lojman gerekebilir)
   ├── Şube ise → günde maks. 1 atama (çift kesinlikle yasak)
   ├── Migros ise → APPROVED_PAIRS kontrolü: onaylı çift varsa 2. slot açılabilir
   └── Ata → bir sonraki mağazaya geç

4. GEÇİŞ 2 — Boş Günleri İkinci Denetimlerle Doldur
   ├── Birinci denetimler bitti; şimdi ikinci denetimler planlanır
   ├── Her denetmenin boş günleri öncelikli olarak doldurulur
   ├── Şube kuralı ve onaylı çift kuralı bu geçiş için de geçerlidir
   └── Hedef: 5 günün tamamı mağaza ile dolu olsun

5. Konaklama Kararı (her gün sonu)
   ├── dist(son_mağaza, ev) > 80 km → lojman ara
   ├── Firestore'dan en yakın lojmanı seç (haversine)
   └── Aynı lojmanda birden fazla denetmen → "Ortak Konaklama" rozeti

6. Çıktı
   ├── Denetmen bazlı tablo (gün | mağaza | şehir | mesafe | konaklama | tür)
   └── Algoritma notları (neden bu planı oluşturdu)
```

---

## 8. Senaryo Örneği (Referans)

> Bu senaryo kuralların nasıl işlediğini gösterir; değişken veri ile sonuçlar farklılaşır.

| Gün | Denetmen | Mağaza | Konaklama |
|-----|----------|--------|-----------|
| Pazartesi | Salih B. | Konak-2 (İzmir) | İzmir Lojmanı |
| Salı | Salih B. | Balıkesir Mağaza | Bursa Lojmanı |
| Salı | Serkan B. | Edremit (evine yakın) | Evde |
| Salı | Serkan B. | Sakarya | Bursa Lojmanı |
| Çarşamba | Her ikisi | Afyon + Afyonpark | Eskişehir Lojmanı |
| Perşembe | Her ikisi | Eskişehir Mağazaları | Bursa Lojmanı |
| Cuma | Salih B. | Akhisar → Eve | — |
| Cuma | Serkan B. | Bergama → Eve | — |
| Cumartesi* | Serkan B. | Aliağa | — |

*Cumartesi çalışması isteğe bağlıdır; sistem önermez ama not düşer.

---

## 9. Gelecek Geliştirmeler (Eklenecekler)

- [ ] Denetmen bazlı günlük km limiti (örn. 300 km/gün)
- [ ] Araç paylaşımı otomatik tespiti (ortak lojmandan aynı güzergah)
- [ ] Tatil / izin günlerini programa entegre etme
- [ ] Mağazanın açılış/kapanış saati kısıtı
- [ ] Öncelikli mağaza etiketi (manuel "acil denetim" işareti)
- [ ] Çıktıyı takvime doğrudan kaydetme (bulk add)
- [ ] Haftalık km raporu / yakıt maliyet tahmini

---

## 10. Onaylı İkili Denetim Çiftleri

> Aşağıdaki çiftler, **Migros mağazaları** için aynı günde ziyaret edilebilen tek istisnalardır.
> **Şube türündeki mağazalar bu listede yer almaz ve aynı güne kesinlikle iki şube atanamaz.**
> Migros çiftleri: ikisi de uygunsa aynı güne atanabilir (zorunlu değil).
> Bu listede **olmayan** kombinasyonlar kesinlikle aynı güne planlanamaz.

### 10.1 Kural

- **Şube türü mağazalar:** Günde kesinlikle 1 şube denetlenir. İkinci şube ataması algoritmik olarak engellenir.
- **Migros çiftleri:** Her iki mağaza da o haftanın uygun listesindeyse → **aynı güne birlikte atanabilir** (opsiyonel).
- Çiftteki yalnızca biri uygunsa → **tek başına planlanır** (normal 1 mağaza/gün kuralı uygulanır).
- Çiftler birbirine **≤ 50 km** mesafededir (aynı şehir veya komşu ilçe).
- Migros çifti atanmış bir güne **şube eklenemez**; şube atanmış bir güne **Migros çifti eklenemez**.

### 10.2 Onaylı Çift Listesi

| Çift No | Mağaza 1 | Mağaza 2 | Şehir/Bölge | Tahmini Yol Mesafesi |
|---------|----------|----------|-------------|----------------|
| Ç-01 | Güzelbahçe (Migros) | Balçova (Migros) | İzmir | ~20 km |
| Ç-02 | Özkanlar Migros | Forum Migros | İzmir | ~15 km |
| Ç-03 | Bostanlı M. | Çiğli Migros | İzmir | ~12 km |
| Ç-04 | Bodrum 3 | Bodrum Yalikavak | Bodrum | ~15 km |
| Ç-05 | Bodrum 5 | Bodrum Galleria | Bodrum | ~10 km |
| Ç-06 | Altınkum | Didim (Migros) | Aydın/Didim | ~8 km |
| Ç-07 | Eskişehir-1 | Eskişehir-2 | Eskişehir | ~5 km |
| Ç-08 | Balıkesir-1 | Balıkesir-2 | Balıkesir | ~5 km |
| Ç-09 | Kütahya-1 | Kütahya-2 | Kütahya | ~5 km |
| Ç-10 | Denizli-1 | Denizli-3 | Denizli | ~8 km |
| Ç-11 | Bursa Özlü | Bursa Yıldız | Bursa | ~10 km |
| Ç-12 | Manisa-1 | Manisa Güney | Manisa | ~8 km |

> **Yeni çift eklemek için:** Bu tabloya satır ekleyin ve `ai-schedule-dialog.tsx` içindeki `APPROVED_PAIRS` sabitini güncelleyin.

### 10.3 Kod Karşılığı

```typescript
// components/admin/schedule/ai-schedule-dialog.tsx
// Bu sabit, rules/bölüm-10 ile senkronize tutulmalıdır.
const APPROVED_PAIRS: [string, string][] = [
  ["Güzelbahçe Migros", "Balçova Migros"],   // Ç-01
  ["Özkanlar Migros", "Forum Migros"],         // Ç-02
];
```

### 10.4 Algoritma Davranışı

```
Günlük slot doldurmadan önce:
  1. Mağaza şube mi? → EVET → o gün zaten dolu ise atla (şube çifti yasak)
  2. Mağaza Migros mu? → EVET →
     a. APPROVED_PAIRS içinde eşleşme var mı?
     b. Çiftinin diğer mağazası bu haftanın eligible listesinde mi?
     c. Çiftler arası yol mesafesi ≤65 km mi?
     → Tümü evet ise: ikisini aynı güne ata, slot dolu
  3. Çift bulunamazsa veya koşullar sağlanmazsa → Normal kural: 1 mağaza/gün

Boş gün doldurma (Geçiş 2):
  → Her denetmenin boş günleri ikinci denetimlerle doldurulur
  → Şube/Migros kuralları yine geçerlidir
  → Hedef: 5/5 gün dolu
```

---
