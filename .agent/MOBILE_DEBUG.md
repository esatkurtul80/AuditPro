# Mobil Debug Logger Kullanım Kılavuzu

## Özellik Tanımı

Mobil cihazlarda (Android APK ve iOS PWA) hata ayıklama yapmak için özel olarak geliştirilmiş bir console logger sistemi.

## Nasıl Aktif Edilir?

### Aktivasyon Yöntemi
1. **Mobil cihazınızda** uygulamayı açın
2. **Üst kısımdaki "AuditPro" logosuna** arka arkaya **10 kere** dokunun
3. Debug logger modal penceresi otomatik olarak açılacaktır

> **NOT:** Logo'ya 3 saniye içinde 10 kere dokunmanız gerekiyor. Eğer 3 saniye geçerse sayaç sıfırlanır.

---

## Özellikleri

### 📝 Console Log Yakalama
- Tüm `console.log()` kayıtları
- Tüm `console.warn()` uyarıları  
- Tüm `console.error()` hataları
- Tüm `console.info()` bilgileri

Son **100 log kaydı** saklanır.

### 💾 Logları Kopyalama
- **"Kopyala"** butonuna tıklayın
- Tüm loglar + cihaz bilgileri clipboard'a kopyalanır
- WhatsApp, mail veya herhangi bir platforma yapıştırabilirsiniz

### 🗑️ Logları Temizleme
- **"Temizle"** butonuna tıklayın
- Tüm log kayıtları silinir
- Yeni log kayıtları yakalanmaya devam eder

### 📱 Cihaz Bilgileri
Debug logger otomatik olarak şu bilgileri gösterir:
- User Agent (Tarayıcı ve cihaz bilgisi)
- Ekran Boyutu (screen width x height)
- Viewport Boyutu (window width x height)
- Platform (iOS, Android, vb.)
- Dil ayarı
- İnternet bağlantısı durumu (Online/Offline)
- Cookie aktif mi?
- Log alındığı zaman (Timestamp)

---

## Kullanım Senaryoları

### Senaryo 1: Duyuru Okuma Hatası
**Durum:** Mobil cihazda duyuru okuması kaydedilmiyor.

**Çözüm:**
1. AuditPro logosuna 10 kere dokunun
2. Debug logger'ı açın
3. Bir duyuruyu açın (accordion)
4. Logger'da şu mesajları arayın:
   - `[Announcement Read Tracking] Marking as read`
   - `[markAnnouncementAsRead] Starting...`
   - `[markAnnouncementAsRead] Success`
5. Eğer hata varsa error mesajlarını kopyalayın
6. Destek ekibine gönderin

### Senaryo 2: Genel Uygulama Hatası
**Durum:** Uygulama beklenmedik şekilde çalışmıyor.

**Çözüm:**
1. Debug logger'ı aktif edin
2. Hataya neden olan işlemi tekrarlayın
3. **Kırmızı** renkteki ERROR loglarını inceleyin
4. "Kopyala" butonuna basıp tüm logları kopyalayın
5. Sorunu bildir

### Senaryo 3: Performans Sorunları
**Durum:** Uygulama yavaş çalışıyor veya donuyor.

**Çözüm:**
1. Logger'ı açın
2. **Sarı** renkteki WARN loglarını kontrol edin
3. Zaman damgalarına bakarak hangi işlemlerin uzun sürdüğünü belirleyin
4. Cihaz bilgilerini kontrol edin (düşük RAM, eski cihaz olabilir)

---

## Log Renk Kodları

| Renk | Log Seviyesi | Anlam |
|------|--------------|-------|
| 🔴 Kırmızı | ERROR | Kritik hata, işlem başarısız |
| 🟡 Sarı | WARN | Uyarı, potansiyel sorun |
| 🔵 Mavi | INFO | Bilgilendirme mesajı |
| ⚪ Gri | LOG | Genel log kaydı |

---

## Önemli Notlar

### ✅ Ne Zaman Kullanmalı?
- Mobil cihazda beklenmedik davranışlar
- Özellik çalışmıyor gibi görünüyor
- Destek ekibi log istediğinde
- Hata raporlama için kanıt toplama

### ❌ Ne Zaman Kullanmamalı?
- Normal kullanım sırasında (performansı etkileyebilir)
- Log'ları paylaşırken **kişisel bilgi** içerip içermediğini kontrol edin

### 🔒 Güvenlik
- Logger sadece **sizin cihazınızda** çalışır
- Loglar otomatik olarak hiçbir yere gönderilmez
- "Kopyala" butonuna siz basmadıkça paylaşılmaz
- Hassas bilgiler varsa logları paylaşmadan önce temizleyin

---

## Sık Sorulan Sorular

### S: Logger her zaman aktif mi?
**C:** Hayır, sadece modal açıkken console loglarını yakalar. Kapatınca normal console'a döner.

### S: Performansı etkiler mi?
**C:** Modal kapalıyken etkilemez. Açıkken minimal etki vardır (son 100 log saklanır).

### S: iOS ve Android'de fark var mı?
**C:** Hayır, her iki platformda da aynı şekilde çalışır.

### S: Desktop'ta da çalışır mı?
**C:** Evet, ama desktop'ta zaten Chrome DevTools var. Bu özellik mobil cihazlar için tasarlandı.

### S: Loglar ne kadar süre saklanır?
**C:** Uygulama kapatılana kadar. Yeni açtığınızda loglar temizdir.

---

## Teknik Bilgi (Geliştiriciler İçin)

### Dosya Konumları
- Component: `components/mobile-debug-logger.tsx`
- Aktivasyon: `components/dashboard-layout.tsx` (line ~50)

### Nasıl Çalışır?
1. Component mount olduğunda `console` metodları override edilir
2. Her console metodu çağrıldığında:
   - Orijinal metod çağrılır (normal console davranışı)
   - Log entry state'e eklenir
3. Component unmount olduğunda orijinal metotlar restore edilir

### Log Formatı
```typescript
interface LogEntry {
    timestamp: Date;
    level: "log" | "warn" | "error" | "info";
    message: string;
    data?: any;
}
```

### Kopyalama Formatı
```
=== Cihaz Bilgileri ===
User Agent: [...]
Ekran Boyutu: [...]
[...]

=== Loglar ===
[14:30:45] [LOG] Message here
[14:30:46] [ERROR] Error message
```

---

## Destek

Sorun yaşarsanız:
1. Debug logger ile logları kopyalayın
2. Cihaz bilgilerini ekleyin
3. Sorunu tarif edin
4. Destek ekibine gönderin

**İletişim:** Lütfen logları ve cihaz bilgilerini tam olarak gönderin, bu sayede sorunu hızlıca çözebiliriz.
