# AuditPro - Kapsamlı Sistem Dokümantasyonu

Bu doküman, AuditPro web uygulamasının tüm teknik ve operasyonel detaylarını içerir. Sunum ve eğitim materyalleri hazırlamak için kaynak olarak kullanılabilir.

---

## 1. Proje Hakkında
**AuditPro**, perakende sektöründe mağaza denetimlerini dijitalleştiren, operasyonel mükemmelliği hedefleyen ve veri odaklı karar almayı sağlayan bütünleşik bir yönetim platformudur.

**Temel Amaçlar:**
*   Kağıt/Excel bazlı denetim süreçlerini ortadan kaldırmak.
*   Mağaza eksikliklerinin (Aksiyonların) takibini otomatize etmek.
*   Bölge ve mağaza performanslarını anlık olarak ölçmek.
*   Şeffaf ve hesap verilebilir bir denetim mekanizması kurmak.

---

## 2. Modüller ve Kullanıcı Rolleri

AuditPro, 4 ana modül üzerine inşa edilmiştir. Her modül, ilgili kullanıcı rolünün ihtiyaçlarına göre özelleştirilmiştir.

### A. 👑 Yönetici Paneli (Admin)
Sistemin beynidir. Tüm süreçlerin kontrol edildiği merkezdir.
*   **Kullanıcılar:** Üst Yönetim, Operasyon Müdürleri.
*   **Temel Özellikler:**
    *   **Dashboard:** Canlı denetim akışı, bekleyen onaylar, özet grafikler.
    *   **Denetim Planlama (Schedule):** Takvim üzerinden "Sürükle-Bırak" mantığıyla veya manuel olarak denetmenlere mağaza atama.
    *   **Soru Havuzu Yönetimi:** Kategorilere ayrılmış, puanlı ve kurallı soru setleri oluşturma.
    *   **Aksiyon Onay Merkezi:** Mağazaların gönderdiği aksiyon çözümlerini inceleme, onaylama veya reddetme (revize isteme).
    *   **Gelişmiş Raporlama:**
        *   *Puan Raporu*: Mağaza başarı sıralamaları.
        *   *Aksiyon Performansı*: Hangi mağaza eksiklikleri ne kadar sürede tamamlıyor?
        *   *Denetmen Karnesi*: Denetmenlerin saha performansı.
        *   *Özel Rapor*: İstenilen kriterlere göre PDF rapor üretimi.

### B. 🕵️ Denetmen Paneli (Auditor)
Sahadaki gözlemcilerin kullandığı mobil uyumlu arayüzdür.
*   **Kullanıcılar:** Saha Denetmenleri.
*   **Temel Özellikler:**
    *   **Haftalık Rota:** Kendisine atanan ziyaret planını görüntüleme.
    *   **Akıllı Denetim Formu:**
        *   Fotoğraf yükleme (Kamera/Galeri).
        *   Sesli/Yazılı not alma.
        *   Taslak kaydetme (İnternet kesintisine karşı).
    *   **Mağaza Analizi:** Denetime başlamadan önce mağazanın "Geçmiş Karnesi"ni görüntüleme (Önceki puanlar, kronik sorunlar).

### C. 🏪 Mağaza Paneli (Store)
Denetlenen birimlerin aksiyon aldığı arayüzdür.
*   **Kullanıcılar:** Mağaza Müdürleri.
*   **Temel Özellikler:**
    *   **Denetim Sonuçları:** Detaylı denetim raporunu görüntüleme.
    *   **Aksiyon Yönetimi:**
        *   Eksiklikleri görme.
        *   Düzeltme yapıp kanıt fotoğrafı yükleme.
        *   Merkeze onaya gönderme.
    *   **Bildirimler:** Yeni denetim tamamlandığında veya aksiyon reddedildiğinde anlık bildirim alma.

### D. 👔 Bölge Müdürü Paneli (Regional Manager)
Bölgesel performansın takip edildiği yönetim özet ekranıdır.
*   **Kullanıcılar:** Bölge Müdürleri.
*   **Temel Özellikler:**
    *   **Bölge Karnesi:** Sorumlu olduğu mağazaların ortalama puan durumu.
    *   **Aksiyon Takibi:** Bölgesindeki "Geciken" veya "Bekleyen" aksiyonları izleme.
    *   **Denetim Takvimi:** Bölgesindeki planlanmış denetimleri görme.

---

## 3. Puanlama Sistemi 🧮

Sistem, adil ve dengeli bir puanlama algoritması kullanır.

### Puanlama Mantığı
1.  **Soru Bazlı Puan:** Her sorunun kendine ait bir `Maksimum Puan` değeri vardır.
2.  **Cevap Türleri ve Etkisi:**
    *   ✅ **Evet:** Tam Puan kazandırır.
    *   ❌ **Hayır:** 0 Puan kazandırır.
    *   ➖ **Muaf:** Puanlamaya dahil edilmez (Sanki o soru hiç sorulmamış gibi davranır).
3.  **Bölüm Puanı Hesabı:**
    *   `(Bölümdeki Toplam Kazanılan Puan / Bölümdeki Toplam Maksimum Puan) * 100`
4.  **Genel Mağaza Puanı:**
    *   Tüm bölümlerin puanlarının aritmetik ortalaması alınır.
    *   *Örnek:* Temizlik Bölümü (100) + Düzen Bölümü (80) + Personel Bölümü (90) = Ortalama **90 Puan**.

### Otomatik Değerlendirme
*   Denetim tamamlandığı anda puan otomatik olarak hesaplanır.
*   Puanlar anlık olarak veritabanına işlenir ve tüm raporlara yansır.

---

## 4. Aksiyon (Eksiklik Giderme) Döngüsü 🔄

Denetim sadece puan vermek değil, eksiklikleri gidermektir. AuditPro'nun en güçlü yanı bu döngüdür.

### Adım 1: Aksiyon Tespiti (Denetim Anı)
*   Denetmen bir soruya **"Hayır"** cevabı verirse VEYA Puanlı bir soruda tam puan vermezse;
*   Sistem bu soruyu otomatik olarak **"Aksiyon Gerektiren Madde"** olarak işaretler.
*   Bu maddeler için denetmenin **Fotoğraf** yüklemesi ve **Açıklama** girmesi zorunludur.

### Adım 2: Mağazaya Bildirim
*   Denetim "Tamamlandı" statüsüne geçtiği anda mağazaya bildirim gider.
*   Mağaza panelinde "Aksiyon Bekleyenler" listesine düşer.

### Adım 3: Süre ve Çözüm (Mağaza)
*   ⏳ **Aksiyon Süresi:** Mağazanın aksiyonu tamamlaması için **3 İş Günü** (Pazar hariç) süresi vardır.
*   Mağaza eksikliği giderir, **Kanıt Fotoğrafı** çeker ve sisteme yükleyerek **"Onaya Gönder"** der.
*   Statü: `Aksiyon Bekleniyor` -> `Onay Bekleniyor`

### Adım 4: Yönetici Onayı (Admin)
*   Admin panelde "Aksiyonlar" sayfasına düşer.
*   Yönetici, mağazanın gönderdiği fotoğrafı ve açıklamayı inceler.
    *   👍 **Onayla:** Aksiyon kapanır, puan raporuna "Zamanında/Geç" bilgisi işlenir.
    *   👎 **Reddet:** Yönetici red sebebi yazar. Aksiyon tekrar mağazaya döner (Adım 3'e geri döner).

---

## 5. Denetim Formu ve Soru Yapısı 📝

Denetim formları dinamik ve esnektir.

### Soru Tipleri
1.  **Evet / Hayır / Muaf:** Puanlamaya etki eden temel soru tipi.
2.  **Çoktan Seçmeli:** Belirli seçeneklerden birini seçtirme.
3.  **Çoklu Seçim (Checkbox):** Birden fazla eksiklik seçimi.
4.  **Puanlama (Rating):** 1-5 arası yıldız verme.
5.  **Bilgi Amaçlı:**
    *   Tarih Seçimi (Örn: SKT kontrolü)
    *   Sayı Girişi (Örn: Personel sayısı)
    *   Metin Girişi (Örn: Açıklama)

### Zorunluluk Kuralları
*   📷 **Fotoğraf Zorunluluğu:** Kritik sorularda "Hayır" denildiğinde fotoğraf yüklemeyi zorunlu kılabilir.
*   📝 **Not Zorunluluğu:** "Hayır" cevaplarında açıklama girmeyi zorunlu kılar.
*   📍 **Konum Doğrulama:** Denetimin mağaza konumunda yapıldığını GPS ile doğrulama (Opsiyonel).

---

## 6. Teknik Özellikler ⚙️

*   **Altyapı:** Next.js (React Framework) + TypeScript
*   **Veritabanı:** Google Firebase (Gerçek zamanlı veri senkronizasyonu)
*   **Depolama:** Firebase Storage (Fotoğraflar için güvenli bulut alanı)
*   **Tasarım:** Modern, Responsive (Mobil/Tablet/Masaüstü uyumlu)
*   **Dışa Aktarım:**
    *   Excel (XLSX) Raporlar
    *   PDF Denetim Karneleri (Görsel ağırlıklı)

---

## 7. Sistem Özet Akışı
1.  **Admin** denetimi planlar.
2.  **Denetmen** mağazaya gider, formu doldurur, fotoğrafları çeker ve tamamlar.
3.  **Sistem** puanı hesaplar, raporu oluşturur.
4.  **Mağaza** eksikleri görür, düzeltir ve fotoğraflar.
5.  **Admin** düzeltmeleri onaylar.
6.  **Bölge Müdürü** tüm süreci izler ve performans analizi yapar.
