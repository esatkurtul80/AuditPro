# Project Version

**Current Version:** v2.2.29

## Changelog

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
