# Dentravia masaüstü (Windows)

Dentravia CRM'i (crm.dentravia.com) kendi penceresinde açan küçük program. CRM'in kendisi sunucuda çalışır; bu depoda
yalnızca pencere, sistem tepsisi, bildirimler ve otomatik güncelleme vardır. Hasta verisi ya da CRM kodu içermez.

- **Kurulum:** [Releases](https://github.com/noncreativetr/dentravia-desktop/releases/latest) sayfasından
  `Dentravia-Kurulum-x.y.z.exe` (Windows 32 ve 64 bit tek dosya). İmzasız olduğu için Windows "bilgisayarınızı korudu"
  diyebilir: "Ek bilgi" → "Yine de çalıştır".
- **Güncelleme:** Program açılışta ve 4 saatte bir yeni sürümü denetler, arka planda indirir ve "Dentravia güncellemesi
  hazır" bildirimi gösterir; tıklayınca birkaç saniyede güncellenip yeniden açılır. Tepsi menüsünde de
  "Güncellemeyi yükle" / "Güncellemeleri denetle" vardır.
- **Bildirimler:** Program çalışırken (küçültülmüş ya da sistem tepsisindeyken de) yeni hasta mesajında Windows
  bildirimi gelir. Pencere kapatılınca program tepside çalışmaya devam eder; Windows açılışında gizli başlar.

- **Uzaktan destek:** CRM'in sağ altındaki destek penceresinde Dentravia ekibi bağlanma izni isterse ve kişi "İzin
  ver"e basarsa program [RustDesk](https://github.com/rustdesk/rustdesk)'i açar ve RustDesk ID'sini destek penceresine
  doldurur; tek kullanımlık şifreyi kişi RustDesk penceresinden yazar. "Bağlantıyı bitir" ya da programdan çıkış
  RustDesk'i kapatır. İzin verilmeden RustDesk hiç çalışmaz.

## Üçüncü taraf yazılım

Kurulum dosyası RustDesk 1.5.1'in resmi Windows dosyalarını değiştirilmeden içerir (64 bit `rustdesk-1.5.1-x86_64.exe`,
32 bit `rustdesk-1.5.1-x86-sciter.exe`). Derleme, dosyaları RustDesk'in GitHub sürüm sayfasından indirip sabit SHA-256
değerleriyle doğrular. RustDesk AGPL-3.0 lisanslıdır; lisans metni kurulumda `resources/rustdesk/LICENSE.txt` olarak
gelir, kaynak kodu https://github.com/rustdesk/rustdesk/tree/1.5.1 adresindedir.

## Yeni sürüm yayınlamak

`package.json` içindeki `version` değerini artırıp (ör. 1.2.0 → 1.3.0) main dalına gönderin. GitHub Actions kurulum
dosyasını üretip v1.3.0 adıyla Releases'e koyar; kurulu programlar birkaç saat içinde kendini günceller. Sürüm numarası
değişmeden yapılan gönderimler yalnız derlemeyi dener, yeni sürüm yayınlamaz.

Electron 43 kullanılır: 32-bit Windows dosyası yayımlanan son Electron sürüm hattı budur. Electron 46 çıktığında 43
güvenlik güncellemesi almayı bırakır; o zaman 32-bit desteği bırakılıp sürüm yükseltilmelidir.
