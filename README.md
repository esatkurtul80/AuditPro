# AuditPro - Kurumsal Denetim Yönetim Sistemi

AuditPro, işletmelerin ve denetmenlerin saha denetimlerini dijital ortamda, hızlı ve güvenilir bir şekilde gerçekleştirmelerini sağlayan kapsamlı bir denetim yönetim panelidir.

## 🚀 Özellikler

- **Çoklu Kullanıcı Rolleri:** Admin ve Denetmen (Auditor) rolleri ile yetkilendirme yönetimi.
- **Dinamik Soru Yönetimi:** Admin paneli üzerinden denetim kategorileri ve soruları oluşturma, düzenleme.
- **Puanlama Sistemi:** Evet/Hayır, 1-5 Puanlama, Çoktan Seçmeli ve Checkbox gibi farklı soru tipleri ile detaylı puanlama.
- **Offline Çalışma:** Denetmenler internet olmadan denetim yapabilir, internet geldiğinde veriler senkronize edilir.
- **Fotoğraf ve Not Ekleme:** Denetim sırasında her soruya fotoğraf kanıtı ve açıklayıcı notlar eklenebilir.
- **Detaylı Raporlama:** Denetim sonunda otomatik hesaplanan puanlar ve kategori bazlı başarı özetleri.
- **Yönetici Paneli (Dashboard):** Mağaza, kullanıcı ve denetim tiplerinin tek bir yerden yönetimi.

## 🛠 Teknolojiler

Bu proje aşağıdaki modern teknolojiler kullanılarak geliştirilmiştir:

- **Frontend:** [Next.js](https://nextjs.org/) (React Framework)
- **UI Kütüphanesi:** [shadcn/ui](https://ui.shadcn.com/) & [Tailwind CSS](https://tailwindcss.com/)
- **Backend & Veritabanı:** [Firebase](https://firebase.google.com/) (Firestore, Auth, Storage)
- **İkon Seti:** [Lucide Icons](https://lucide.dev/)

## 📦 Kurulum ve Çalıştırma

Projeyi yerel ortamınızda çalıştırmak için aşağıdaki adımları izleyin:

### 1. Gereksinimler
- Node.js (v18 veya üzeri)
- Git

### 2. Projeyi İndirme
```bash
git clone https://github.com/esatkurtul80/AuditPro.git
cd AuditPro
```

### 3. Paketleri Yükleme
```bash
npm install
# veya
yarn install
```

### 4. Çevresel Değişkenler (.env)
Ana dizinde `.env.local` dosyası oluşturun ve Firebase ayarlarınızı ekleyin:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 5. Uygulamayı Başlatma
```bash
npm run dev
```
Uygulama `http://localhost:3000` adresinde çalışacaktır.

## 📖 Kullanım Kılavuzu

### Yönetici (Admin) Girişi
- **Dashboard:** Genel durum özeti, mağaza ve denetmen sayıları.
- **Mağaza Yönetimi:** Yeni mağaza ekleme, düzenleme veya silme.
- **Kullanıcılar:** Denetmen hesapları oluşturma ve yetkilendirme.
- **Sorular:** Denetim formlarının şablonlarını oluşturma (Kategori -> Soru Ekleme).

### Denetmen (Auditor) Girişi
1. **Denetim Başlat:** Atanan mağazalar arasından seçim yaparak yeni bir denetim başlatır.
2. **Soruları Cevapla:** Formdaki soruları sırasıyla cevaplar. Gerekirse fotoğraf çeker veya galeriden yükler.
3. **Özet Ekranı:** Denetim bitmeden önce eksik soruları ve puan durumunu kontrol eder.
4. **Tamamla:** Denetimi sunucuya gönderir ve işlemi bitirir.

## 🔒 Lisans

Bu proje özel mülkiyettir. İzinsiz kopyalanması veya dağıtılması yasaktır.
