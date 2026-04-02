# Project Version

```json
{
  "version": "3.0.3",
  "build": 119,
  "status": "stable"
}
```

## [3.0.3] - 2026-04-02

### v3.0.3
- **Bölüm Görüş & Önerileri Yazma Koruması:** `updateSectionFeedback` fonksiyonuna `isWriting` ve `lastLocalWriteTime` guard'ları eklendi. Artık bölüm görüş alanına yazılırken Firestore'dan gelen `onSnapshot` echo'su 3 saniye boyunca bastırılıyor ve yazılan metin silinmiyor.
- **Mobil Klavye Kapatma Koruması:** `onSnapshot` listener'daki `skipSectionsSync` kontrolü güçlendirildi. Önceki kod yalnızca `document.activeElement` kontrolüne dayanıyordu; mobilde klavye kapanınca `activeElement` değiştiğinden koruma devre dışı kalıyordu. Şimdi `isEditing` ref'i de ek kontrol olarak eklendi — kullanıcı textarea'dan odak kaldırana kadar senkronizasyon erteleniyor.

## [3.0.2] - 2026-04-01

### v3.0.2
- **Çok Cihazlı Denetim Senkronizasyonu (Gerçek Zamanlı):** Denetim sayfası `getDoc` (tek seferlik veri çekme) yerine `onSnapshot` (gerçek zamanlı Firestore dinleyicisi) kullanacak şekilde yeniden yazıldı. Tablet ve telefon aynı denetime eş zamanlı bağlandığında cevaplar, notlar ve fotoğraflar anlık olarak her iki cihazda görünüyor.
- **Tamamlama Güvenliği (Çift Cihaz):** "Tamamla" butonuna basıldığında yerel state yerine Firestore'dan anlık olarak en güncel veri çekiliyor. Hangi cihazdan basılırsa basılsın hem tabletin hem telefonun kaydettiği tüm veriler kayıpsız denetime işleniyor.
- **Çapraz Cihaz Tamamlama Yönlendirmesi:** Bir cihazdan denetim tamamlandığında diğer cihaz otomatik olarak salt-görüntü (view) moduna yönlendiriliyor; "Bu denetim başka bir cihazda tamamlandı" bildirimi gösteriliyor.
- **Kendi Yazısını Ezme Sorunu (hasPendingWrites):** `onSnapshot`'ın bu cihazın kendi yazdığı veriyi geri getirip state'i ezmesi, Firestore'un `hasPendingWrites` metadata özelliğiyle kalıcı olarak çözüldü. Özellikle yavaş mobil ağda hızlı işaretleme yapılırken soruların işaretinin geri gitmesi ve görüş/öneri alanında yazarken yazının silinmesi sorunları giderildi.
- **Yazma Sırası Koruması (isWriting Guard):** Firestore'a yazma işlemi devam ederken gelen `onSnapshot` güncellemeleri atlanıyor; yerel state ezilmiyor.
- **Aktif Metin Girişi Koruması:** Kullanıcı herhangi bir textarea/input'a yazarken gelen bölüm (sections) senkronizasyonu erteleniyor.

## [3.0.1] - 2026-03-10


### v3.0.1
- **Duyuru/Bildirim Editörü (Tiptap):** Önceki versiyonlarda kaybolan zengin metin editörü (Rich Text Editor) "Bilgilendirme Gönder" sayfasına tekrar entegre edildi. Kalın, italik, liste, hizalama ve renk paleti fonksiyonları eksiksiz çalışıyor.
- **Editör SSR Hatası:** Next.js (React 19) sunucu render'ı (SSR) sırasında oluşan `hydration mismatch` hatası giderildi.
- **Editör Link Ekleme (Shadcn Popover):** Link ekleme butonundaki yerleşik `window.prompt` penceresi kaldırılarak, yerine şık ve entegre bir Shadcn Popover menüsü eklendi.
- **Editör Resim Ekleme (Firebase Storage):** Araç çubuğuna resim yükleme butonu dahil edildi. Kullanıcı bilgisayarından dosya seçip Firebase Storage'a (`announcements/` klasörüne) anlık yükleyebiliyor. Dosya isimleri çakışmaları ve hataları önlemek için Türkçe karakterlerden arındırılıp (Konu + Tarih + Benzersiz ID) şeklinde kaydediliyor. Dosya eklendiği an Tiptap penceresine işleniyor.

## [3.0.0] - 2026-03-05

### v3.0.0
- **Özel Rapor (Filtre Mantığı):** Onay kutulu sorularda tam puan + not varsa rapora ekleniyor; sadece fotoğraf varsa eklenmiyor. "Evet" cevapları yalnızca not varsa rapora dahil ediliyor.
- **Özel Rapor (Puan Gösterimi):** Mağaza puanı alanındaki sabit `/ 100` ifadesi kaldırıldı; yalnızca gerçek puan gösteriliyor.
- **Mağaza Aksiyon Fotoğrafları (Kırık Görsel):** `Thumbnail` ve `Lightbox` bileşenlerine Firebase Storage süresi dolmuş URL'leri otomatik yenileyen `onError` + `getDownloadURL` mantığı eklendi.
- **Mağaza Aksiyon Fotoğrafları (Kaybolma Hatası):** Fotoğraf yüklendikten sonra `onSnapshot` race condition nedeniyle yerel URL'lerin silinmesi sorunu düzeltildi; sync effect artık yalnızca sunucudan gelen yeni URL'leri ekliyor, yereldekileri silmiyor.
- **Mağaza Aksiyon Fotoğrafları (Timeout & Kısmi Yükleme):** Her fotoğraf bağımsız olarak yükleniyor; 30 saniyelik timeout eklendi. Biri başarısız olsa diğerleri etkilenmiyor.
- **Mağaza Aksiyon Fotoğrafları (Üst Yazma Hatası):** Birden fazla fotoğraf seçildiğinde sonraki yüklemelerin önceki URL'lerin üstüne yazması sorunu düzeltildi; `savedUrls` listesi birikimli olarak güncelleniyor.
- **Mağaza Aksiyon Fotoğrafları (Çevrimdışı Sıkıştırma):** Çevrimdışıyken kaydedilen fotoğraflar çevrimiçi olunca max 0.5MB / 1920px sıkıştırmayla yükleniyor.
- **Mağaza Aksiyon Fotoğrafları (Hızlı Silme):** `storage/object-not-found` hatası sessizce geçiliyor; hızlı silimlerde konsol gürültüsü ortadan kalktı.
- **Storage Klasör Adı:** Mağaza aksiyon fotoğrafları artık `actions/[Mağaza Adı] - [GG.AA.YYYY]/` klasörüne kaydediliyor.
- **Firestore Kuralları:** Mağaza kullanıcıları kendi denetimlerini güncelleyebiliyor (`audits` write izni eklendi). `users` koleksiyonu mağaza kullanıcılarına da okunabilir hale getirildi.


### v2.2.53
- **Firebase Storage Klasör Yapısı:** Fotoğraflar artık `[Denetmen Adı] - [GG.AA.YYYY] / [Bölüm] BOLUMU / [Bölüm] - [N]. SORU FOTOGRAFI.jpg` hiyerarşisinde kaydediliyor. Mağaza aksiyonları için `actions/[Mağaza Adı] - [GG.AA.YYYY]` klasörü kullanılıyor.
- **Türkçe Karakter Sanitizasyonu:** Dosya adlarındaki Türkçe karakterler (ğ→g, ü→u, ş→s, ı→i, ö→o, ç→c) birebir eşleme ile güvenli şekilde dönüştürülüyor; Firebase'de `storage/unknown` hatası artık oluşmuyor.
- **Tarih Formatı Güvenilirliği:** `toLocaleDateString('tr-TR')` yerine manuel `DD.MM.YYYY` oluşturma kullanılarak farklı ortamlarda tutarlı tarih formatı sağlandı.
- **Bölüm Gezintisi (Scroll):** Denetimde bölüme tıklandığında sayfa animasyon olmadan anında en üste atlar.
- **Upload Akışı (Promise.allSettled):** Toplu fotoğraf yükleme işlemlerinde tek bir yükleme başarısız olsa bile diğerleri kayıt altına alınıyor; hatalı yüklemeler kullanıcıya toast ile bildiriliyor.

## [2.2.52] - 2026-03-04

### v2.2.52
- **Sticky Butonlar (Denetim Formu):** Denetmen panelinde denetim formundaki üst aksiyon barı (Geri, Önizleme, Tamamla) sticky konumlandırma sorunu giderildi; header yüksekliği hesaba katılarak her iki ekran boyutunda da sabit kalıyor.
- **Denetim Formları Sıralama:** Admin panelinde denetim formları tablosuna sürükle-bırak satır sıralama özelliği eklendi (dnd-kit). Sıra numaraları Firestore'a otomatik kaydediliyor; denetmen + butonundaki form listesi bu sıraya göre görüntüleniyor.
- **Denetim Bölümleri A-Z:** Admin paneli denetim bölümleri tablosu A-Z Türkçe alfabetik sırayla yükleniyor.
- **Denetçi Performans Raporu (Sekmeler):** Bölüm bazlı puan ortalamaları sekmeleri A-Z Türkçe alfabetik sırayla soldan sağa sıralandı.
- **Soru Tablosu (Admin):** Denetim soruları sayfasına soru puanı sütunu eklendi; "pt" ibaresi kaldırıldı. Kategori düzenleme (inline yeniden adlandırma) özelliği eklendi.


### v2.2.51
- **UI (Veri Yönetimi):** Veri yönetimi detay gör listesine silme (detaydan tek tek JSON belgesi silme) özelliği getirildi.
- Arama ve filtreleme mantığına uygun Shadcn dialog bileşeni eklendi.
- **Sıralama (Mağaza Seçimleri):** Kullanıcı mağaza ayarlamalarındaki ve soru raporlarındaki "Tüm Mağazalar" filtresi alfabetik (A-Z) olarak sıralandı.

## [2.2.50] - 2026-03-02

### v2.2.50
- **UI (Aksiyon Tabloları):** Admin tarafındaki Aksiyon (Onay/Bekleyen) tablolarına "Reddedildi" satır bildirimleri eklendi.
- **Rapor (Aksiyon Performansı):** Aksiyon Performans Raporuna reddedilen/iade edilen aksiyon sayısı yüklendi ve excele entegre edildi.

## [2.2.49] - 2026-03-02

### v2.2.49
- **UI (Notlar ve Medya):** Tamirat/İstek butonu "Bildirim" olarak değiştirildi.
- Bottom Sheet içerisindeki hızlı kategori butonları kaldırıldı.
- Eklenen fotoğraflar ve notlar, Not Ekle/Medya buton setinin (Action Bar) altına alındı.

### v2.2.48
- Changed button design completely: Now using native `<button>` with a custom ripple effect that spreads outward on click.
- Notes and Photos section redesigned into a bottom Action Bar (Not Ekle, Tamirat/İstek, Medya).
- Notes now open in a Bottom Sheet on mobile/desktop with quick-add category buttons.

### v2.2.46
- **Rol Yönetimi (Rapor Yöneticisi):** "Rapor Yöneticisi" adlı yeni kullanıcı rolü sisteme dahil edildi. Bu roldeki kişiler yalnızca veri okuma/görüntüleme yetkisine sahiptir, CRUD işlemleri (silme, düzenleme vb.) yapamazlar. "Özel Raporda Puanlar Görünsün" yetkileri vs. devreden çıkarılmıştır.
- **Rapor Paneli (SPA & UI):** Yönetici paneli, sayfa yenilenmeyen SPA (Single Page Application) formatında 0 milisaniye gecikmeli çalışacak şekilde tasarlandı. Üst menü (header) ve kenar çubuğundaki rozetlerde "Rapor Yöneticisi" yazısı daha sade bir görünüm için "Yönetici" olarak kısaltıldı.
- **UI (Mobil Rapor Tabloları):** Tüm rapor ekranlarındaki (Soru Raporları, Denetçi Aksiyon & Performans Raporları) filtre barı (toolbar) taşmaları `flex-wrap` ile çözüldü. Tarih seçiciler mobil genişliğe %100 uyumlu hale getirildi. 
- **UI (Mobil Overflow Kayması):** "Denetmen Özet Tablosu", "Bölüm Bazlı Puan Ortalamaları" ve "Mağaza Süre Analizi" gibi büyük grid/tablo bileşenlerinin mobil ekran genişliğini bozup patlatması kesin "overflow-x-auto" sarmalayıcıları (wrappers) ile önlendi; tablolar artık mobil ekranda kendi etrafında sağa-sola kaydırılabiliyor.

### v2.2.45
- **Denetmen Programı (PDF İndirme):** Taslak anında (yayınlamadan önce) haftalık denetim programı PDF indirildiğinde hafta sonlarının hatalı/boş görünmesi engellendi. Hafta sonu günleri için artık sistem veritabanı yansımasını beklemeye gerek kalmadan otomatik olarak "Hafta Tatili" ibaresini PDF üzerine işliyor, "hiçbir atama yapılmamış" kural ihlali uyarısı hafta sonları için by-pass ediliyor.

### v2.2.44
- **Fotoğraf Zorunluluğu (Denetim):** "Fotoğraf Zorunlu" seçeneği artık yalnızca "Hayır" cevabı verildiğinde veya tam puan alınamadığında (checkbox, derece, çoktan seçmeli) devreye giriyor. "Muaf" cevabında fotoğraf zorunluluğu kalktı.
- **Fotoğraf Zorunluluğu (Aksiyon):** "Aksiyon İçin Fotoğraf Zorunlu" kuralı aynı mantıkla güncellendi. Mağaza aksiyon dönüşünde de yalnızca "Hayır" veya tam puan alınamayan sorularda fotoğraf zorunlu hale geldi.
- **Admin Soru Tanımı:** "Aksiyon İçin Fotoğraf Zorunlu" toggle'ının yanındaki açıklama metni "(Hayır cevabı verilirse)" → "(Hayır veya tam puan alınamazsa)" olarak güncellendi.
- **Bölüm Soru Ataması (Hata Düzeltme):** "Atanan Sorular" sekmesinde görünen sayı artık Firestore'daki ham ID sayısı yerine gerçekte var olan sorularla eşleşen sayıyı gösteriyor. Silinmiş/geçersiz soru ID'leri sayfa açılışında otomatik temizleniyor.

### v2.2.43
- **Denetçi Performans Raporu (Bölüm Bazlı Puanlar):** "Bölüm Bazlı Puan Ortalamaları" tablosu artık her denetim formu (örn: Puanlı Şube Denetimi, Puanlı Migros) için ayrı sekme gösteriyor. Puan hesaplama ham puan toplamı yerine yüzdelik oran `(kazanılan/maksimum)*100` şeklinde düzeltildi.
- **Personel Raporu:** "Değerlendirmeler" tablosuna ve Excel çıktısına **Bölge Müdürü** sütunu eklendi. Mağazanın atanmış bölge müdürüne göre filtreleme desteği de geldi.
- **Denetçi Puantaj Raporu:** "BLOCKED" iç işaretleyici kayıtlarının raporda görünmesi engellendi. Bu kayıtlar programın kendi içinde kullandığı placeholder olduğu için tabloda gizleniyor.

- **PDF İndirme (Haftalık Program):** Haftalık denetim programı PDF indirme özelliği yeniden yazıldı. `html2pdf.js`/`html2canvas` yerine `jsPDF` + `jspdf-autotable` kullanılarak Tailwind v4'ün `oklab`/`color-mix` CSS renk fonksiyonlarından kaynaklanan konsol hatası tamamen giderildi. Roboto fontları `/public/fonts` üzerinden yüklenerek Türkçe karakter bozulması çözüldü. PDF dosyası artık `X. HAFTA DENETİM PROGRAMI YYYY.pdf` formatında indiriliyor.

### v2.2.41
- **Toplu Mağaza Ekleme & Tablo Geliştirmeleri:** Mağazalar paneline Excel yükleme (.xlsx) ile toplu mağaza ekleme ve şablon indirme özellikleri eklendi. "Puan Raporu" sekmesindeki iki tabloda ve "Mağazalar" tablosunda başlıklar üzerinden manuel sıralama (yukarı/aşağı ok) butonları aktif edilip, tablolara varsayılan olarak "A'dan Z'ye" (alfabetik) sıralı açılma eklendi.

### v2.2.40
- **Hata Düzeltme (Genel Değerlendirme):** "Genel Değerlendirme" bölümüne çevrimdışı fotoğraf eklendiğinde oluşan "sonsuz yükleme döngüsü" (infinite upload loop) ve ağa geri dönüldüğünde/denetim kaydedildiğinde ortaya çıkan "kırık görsel" (broken image URL) hataları tamamen çözüldü. Artık genel değerlendirme yorumları ve fotoğrafları, diğer bölüm soruları gibi anlık olarak (`updateGeneralFeedback`) veritabanına işleniyor.

### v2.2.39
- **Hata Düzeltme (Hydration Mismatch):** SSR (Sunucu Tarafı Oluşturma) sırasında Layout bileşenlerinde (`DashboardLayout` ve `RegionalManagerHeader`) oluşan hydration uyuşmazlığı hataları kalıcı olarak çözüldü. AuthProvider'a `app/layout.tsx` üzerinden cookie entegrasyonu sağlandı ve sunucu DOM ağacı ile istemci ağacının ilk render'da %100 eşleşmesi garanti altına alındı.

### v2.2.38
- **Özel Rapor Genel Değerlendirme:** Denetim formunun en altına (personel değerlendirme sonrasına) "Genel Değerlendirme" eklenebilme özelliği getirildi. Eklenen yorum ve fotoğraflar skoru etkilemiyor ve PDF raporun en altında "Görüş ve Öneriler" olarak belgeleniyor.

### v2.2.37
- **Admin Raporları (Özel Rapor):** Özel raporlardaki (PDF) bölüm değerlendirmesi (Görüş ve Öneriler) kısmında yer alan fotoğraflar artık kırpılmış küçük kareler halinde değil, yüklendiği orijinal boyut ve en-boy oranında tam genişlikte gösteriliyor.

### v2.2.36
- **UI (Mağaza ve Rapor Paneli):** 100 tam puan rozetinin (Mükemmel) tasarımı güncellendi. Kullanıcının talebi doğrultusunda arka gölgelendirmesi olmayan, altın rengi, büyük ve şık bir `Star` (Lucide) ikonunun merkeze alındığı "100" tam puan rozet tasarımına geçildi.

### v2.2.35
- **iOS PWA (Hata Düzeltme):** iOS cihazlarda Safari PWA sürümünün yeniden açılışlarda beyaz ekranda kalmasına ve Auth timeout'a düşmesine sebep olan IndexedDB kilidi ve Firestore tab manager yapılandırmaları düzeltildi.
- **Bölge Müdürü Paneli (SPA):** Bölge Müdürü paneli URL yönlendirmesiz sıfır-milisaniye gecikmeli salt SPA (Single Page Application) yapısına geçirilerek performans iyileştirmesi sağlandı, cache ihtiyacı ortadan kaldırıldı.

### v2.2.34
- **Personel Değerlendirme (Raporlama):** Özel raporda yorumların sıkışmaması için tablo kolon genişlikleri dinamik hale getirildi ve taşmayı önleyen metin kırma (word-break) özelliği eklendi.
- **Personel Değerlendirme (Denetim Formu):** Denetmen panelindeki "Personel Değerlendirme" sekmesi güncellendi. Artık mağazadaki mevcut aktif personeller ile değerlendirilenler gerçek zamanlı dinleniyor; tümü değerlendirildiğinde gösterge "Yeşil", eksik personel varsa "Kırmızı" oluyor ve ("X / Y personel değerlendirildi" şeklinde) detay gösteriliyor.
- **Hata Düzeltme (Hydration Opaque):** Header, Çevrimiçi Kullanıcı sayısı, Lokasyon Rozeti ve Çevrimiçi Rozeti gibi sunucu ile istemci arasında verisi farklılık gösterebilen dinamik bileşenlerdeki React Hydration uyuşmazlığı hataları `suppressHydrationWarning` ile çözüldü.

### v2.2.33
- **Personel Değerlendirme (Offline):** Manuel IndexedDB kuyruğu kaldırıldı. Artık Firestore SDK'nın yerleşik offline cache'i kullanılıyor; çevrimdışı yazılar bağlantı geldiğinde otomatik senkronize oluyor.
- **Personel Değerlendirme (Anlık Kayıt):** Debounce kaldırıldı, her değişimde (skor, yorum, durum) anlık kayıt yapılıyor.
- **Personel Değerlendirme (Hata Düzeltme):** Geri tuşuna basıp tekrar gelince yorum ve puanların kaybolması sorunu giderildi. Listener sıralamasından bağımsız çalışan `evaluationsRef` yaklaşımı ile race condition ortadan kaldırıldı.

### v2.2.32
- **Bölge Müdürü Bildirimleri:** Denetim başladığında ve bittiğinde Bölge Müdürüne anlık bildirim (Push Notification) gönderilmesi sağlandı.
- **Rapor Erişimi:** Bitiş bildirimine tıklanıldığında doğrudan ilgili denetimin "Özel Rapor" sayfasına yönlendirme özelliği eklendi.

### v2.2.31
- **Bölge Müdürü Paneli:** "Dönüş Bekleyen Mağazalar" tablosundaki sütunlar (Durum, İşlem) ortalandı.
- **Bölge Müdürü Paneli:** Bekleyenler listesi mantığı güncellendi: Sadece "Tamamlandı" statüsündeki denetimler ve yanıtlanmamış aksiyonlar listeleniyor (Afyon vb. mağazaların gereksiz listelenmesi önlendi).

### v2.2.30
- **UI/UX (Bölge Müdürü Paneli):** Mağaza kartlarına "Dönüş Bekliyor" statüsü ve kalan gün/geçen gün sayacı eklendi.
- **UI/UX (Bölge Müdürü Paneli):** Mağaza dönüş yapmadıysa buton gizlendi, yaptıysa belirgin hale getirildi.
- **UI/UX (Özel Rapor):** Geri butonu mavi stil ile güncellendi, üst boşluklar azaltıldı, butonlar genişletildi.

### v2.2.29
- **Admin Raporları (Hata Düzeltme):** Radyo butonlu (veya çoktan seçmeli) sorularda puan kaybı yaşandığında sorunun raporda görünmemesi hatası giderildi.
- **Admin Raporları (İyileştirme):** Puan kaybı olan sorularda "EVET" veya "EKSİKLER VAR" yerine, sorunun kaynağı (seçilen şık veya eksik olan maddeler) kırmızı ve kalın font ile açıkça yazılıyor. (Örn: "EKSİKLER: Fiyat Etiketi" veya "Hayır, Düzenlenmedi")
- **Admin Raporları (UI):** Rapor başlığında "MAĞAZA" yazısının yanıp sönmesi engellendi. Doğrudan mağaza adı (Örn: AFYON PARK - MAĞAZA BİLGİLERİ) gösteriliyor.
- **Admin Raporları (UI):** Rapor içindeki fotoğraflara tıklandığında büyük boy önizleme (modal) açılması sağlandı.

### v2.2.28
- **Hata Düzeltme:** Mağaza panelinde "Aksiyon Gör" ve "İncele" butonlarının yönlendirme mantığı düzeltildi.
- **Hata Düzeltme:** Admin panelinde aksiyon onaylama mantığı güncellendi. Puan kaybı olan soruların aksiyon gereklilik durumu global kurala göre yeniden düzenlendi.
- **UI:** Aksiyon detay sayfasında görünürlük iyileştirmeleri yapıldı.

### v2.2.27
- **UI Düzeltme:** Denetmen paneli başlığındaki "AuditPro" logosunun konumu mobil cihazlarda (%37) ve tablet/masaüstü cihazlarda (ortada) olacak şekilde responsif olarak ayarlandı.
- **DevOps:** Google Artifact Registry temizlik politikaları (Cleanup Policies) yapılandırıldı ve test edildi.

### v2.2.26
- **Kod Temizliği:** 30+ dosyada gereksiz `console.log` ifadeleri temizlendi. Hata ayıklama logları (`console.error`, `console.warn`) korundu.
- **Güvenlik:** Firestore kuralları (Security Rules) güncellendi.
- **Optimizasyon:** Build süreci ve paket boyutları optimize edildi.

### v2.2.25
- **Admin Raporları:** Puan Raporu ve Aylık Gelişim Tablosu'ndaki yıl seçimi 2026-2036 aralığına güncellendi. Varsayılan yıl 2026 olarak ayarlandı.
- **Hata Düzeltme:** Admin paneli sol üst köşesindeki logonun ("AuditPro") hosting ortamında kırık görünmesi sorunu giderildi (Next.js Image optimizasyonu yerine standart img etiketi kullanıldı).
- **UI/UX:** Bölge Müdürü panelindeki "Son Denetimler" listesinde gereksiz boşluklar kaldırıldı, daha kompakt bir görünüm sağlandı.

### v2.2.24
- **Bölüm Açıklamaları:** Denetim formuna bölüm açıklamaları eklendi.
- **Bölüm İkonları:** Admin panelinde bölüm ikon seçimi ve denetim formunda dinamik ikon gösterimi eklendi.
- **UI İyileştirmeleri:** Tablet görünümü için Denetim Kartı (Audit Card) tasarımı geliştirildi.

### v2.2.22
- **Düzeltme:** Offline modunda uygulama açılırken (veya arka plandan dönerken) yaşanan `auth/network-request-failed` çökmesi giderildi.
- **Geri Yükleme:** Denetim sırasında bölüm başlığına uzun basarak (veya sağ tıklayarak) bölümü sıfırlama özelliği geri getirildi.
- **Güvenlik:** Bölüm sıfırlama işlemine "Dikkat: Veriler silinecektir" uyarısı içeren onay penceresi eklendi.
- **Tasarım:** Denetim formu tasarımı önceki versiyona döndürüldü.

## v2.2.21
- **Atlandı:** Geliştirme sürümü.

## v2.2.20
- **Güvenlik:** Admin ayarları için İki Faktörlü Doğrulama (2FA) eklendi. Google Authenticator ile QR kod taratılarak giriş yapılıyor.
- **Firebase İstatistikleri:** Firebase Aylık Kullanım Analizi ve Fatura sayfası eklendi. Tahmini ve gerçek maliyet gösterimi.
- **Kota Takibi:** Firestore okuma/yazma/silme ve depolama kullanım oranları görsel olarak takip edilebiliyor.

## v2.2.19
- **Performans:** Sayfa geçişlerinde üst menünün (Header) kaybolmasına neden olan "Loading" sorunu çözüldü.
- **Cache Sistemi:** Kullanıcı profili önbelleğe alınarak, internet yavaş olsa bile menülerin anında yüklenmesi sağlandı (Persistent Layout).

## v2.2.18
- **Çöp Kutusu (Hızlandırma):** Silme ve geri yükleme işlemlerinde sayfa yenileme kaldırıldı. İşlemler artık anlık (optimistic update) olarak gerçekleşiyor.
- **Çöp Kutusu (Yeni Özellik):** "Çöp Kutusunu Boşalt" butonu eklendi. Tek seferde tüm silinmiş öğeleri temizleyebilirsiniz.
- **UX:** Admin panelinde Online Denetimler tablosunun yüksekliği artırıldı (10+ satır görünür).

## v2.2.17
- **Admin Panel (Akıllı Konum):** "Onaylanmadı" durumunda eğer denetmen başka bir mağazaya yakınsa o mağazanın adı parantez içinde gösteriliyor (örn: Onaylanmadı (ADANA)). Hiçbir mağazaya yakın değilse tıklanabilir harita ikonu çıkıyor.
- **Admin Panel (Sıralama):** Devam eden denetimler tablosunda en geç başlayan denetim en altta olacak şekilde sıralama düzenlendi.
- **Sistem (Tablet Güncelleme):** Tabletlerde veya telefonlarda uygulama arka plandan öne gelince (uyku modu çıkışı) otomatik versiyon kontrolü yapılması sağlandı.

## v2.2.16
- **UI/UX Yenileme:** Header ikonları (Wifi, Konum, Bildirim) yuvarlak ve modern tasarıma kavuşturuldu.
- **Konum İyileştirmesi:** Konum servisi uyarıları ve pencereleri kaldırıldı. Sistem artık arka planda sessizce çalışıyor (Silent Failure).
- **Mobil/Tablet Desteği:** Denetmen panelinde tablet görünümünde statü ikonları görünür hale getirildi.
- **Düzeltme:** Admin paneli logosunun görünmeme sorunu giderildi.
- **Düzeltme:** Profil menüsündeki isim baş harflerinin ortalanmama sorunu çözüldü.

## v2.2.15
- **İyileştirme:** Konum alma süresi uzatıldı (30sn). Bu sayede telefonun "Konumu Aç" penceresinin zaman aşımına uğraması engelleniyor.

## v2.2.14
- **İyileştirme:** Konum uyarısındaki seçenek "Konum İzni İste" olarak güncellendi. Butona basıldığında cihazdan tekrar konum açması isteniyor.

## v2.2.13
- **İyileştirme:** Konum alınamadığında "Konumsuz Devam Et" veya "Tekrar Dene" seçeneklerini sunan diyalog eklendi. Hem bildirim hem esneklik sağlandı.

## v2.2.12
- **İyileştirme:** Konum hatası durumunda uyarı mesajı kaldırıldı, denetim arka planda sessizce başlatılıyor.

## v2.2.11
- **Güncelleme:** Konum zorunluluğu esnetildi. Konum alınamasa bile uyarı verilerek denetim başlatılabilecek.

## v2.2.10
- **Kritik Düzeltme:** "Hızlı Denetim Başlat" (FAB) butonuna da zorunlu konum kontrolü eklendi.

## v2.2.9
- **UI Güncellemesi:** "Hatalı" ibaresi "Onaylanmadı" olarak değiştirildi.

## v2.2.8
- **Hata Düzeltme:** Konum verisi alınmadan denetim başlatılması tamamen engellendi (Çift kontrol).

## v2.2.7
- **Hata Ayıklama:** Konum doğrulama sütununda "Mağaza Konumsuz" ve "Denetim Konumsuz" ayrıntılı durumları eklendi.

## v2.2.6
### 🗓️ 05 Şubat 2026
- **Konum Doğrulama:** Admin panelinde denetimler listesine "Konum" sütunu eklendi. (100m mesafe kontrolü)
- **Denetim Başlatma Kontrolü:** Denetim başlatılırken GPS konumu zorunlu hale getirildi.
- **Hata Yönetimi:** GPS kapalıysa kullanıcıya uyarı veren dialog eklendi.
- **Online Denetimler:** Online denetimler tablosuna da konum doğrulama sütunu eklendi.
- **Performans:** DataTable bileşenlerinde gereksiz renderlar optimize edildi.

## v2.2.5
- Denetmen panelinde çift header sorunu çözüldü (GlobalHeader denetmenler için kapatıldı).
- Ayarlar sayfasına "Geri" butonu eklendi.
- Mağaza analizi modal genişliği artırıldı (Responsive yapıya uygun hale getirildi).
- Bildirim izin akışları doğrulandı.

## v2.2.4
