# WhatsApp Mesaj Gönderici

Bu uygulama, WhatsApp üzerinden tek veya toplu mesaj göndermenizi sağlayan kullanıcı dostu bir web arayüzüne sahip bir araçtır.

## Özellikler

- Tek kişiye hızlı mesaj gönderme
- CSV dosyası ile toplu mesaj gönderme
- Mesajları belirtilen sayıda tekrarlama
- Kullanıcı dostu web arayüzü
- Gönderim durumu takibi
- Otomatik tarayıcı kapatma

## Kurulum

1. Python 3.8 veya daha yeni bir sürümü yükleyin.
2. Bu depoyu bilgisayarınıza indirin veya klonlayın.
3. Gerekli paketleri yükleyin:

```
pip install -r requirements.txt
```

## Kullanım

### Web Arayüzü ile Kullanım

1. `baslat.bat` dosyasına çift tıklayın veya aşağıdaki komutu çalıştırın:

```
python whatsapp_sender.py --web
```

2. Web tarayıcınızda `http://localhost:5000` adresini açın.
3. Tek mesaj göndermek için "Tek Mesaj" sekmesini, toplu mesaj göndermek için "Toplu Mesaj" sekmesini kullanın.

### Komut Satırı ile Kullanım

```
python whatsapp_sender.py --csv recipients.csv --message "Merhaba, bu bir test mesajıdır." --repeat 1 --wait 0
```

Parametreler:
- `--csv`: Alıcıların bulunduğu CSV dosyası (varsayılan: recipients.csv)
- `--message`: Tüm alıcılara gönderilecek varsayılan mesaj
- `--repeat`: Her mesajın kaç kez tekrarlanacağı (varsayılan: 1)
- `--wait`: Her mesaj arasında beklenecek süre (saniye) (varsayılan: 0)

## CSV Dosya Formatı

CSV dosyası aşağıdaki formatta olmalıdır:

```
phone,message
905xxxxxxxxx,Merhaba
905xxxxxxxxx,Selam
```

- `phone`: Telefon numarası (ülke kodu ile birlikte, + işareti olmadan)
- `message`: Gönderilecek mesaj (opsiyonel, belirtilmezse varsayılan mesaj kullanılır)

## Notlar

- İlk mesaj gönderilmeden önce WhatsApp Web'e giriş yapmanız gerekebilir.
- Telefon numaraları uluslararası formatta olmalıdır (örn: 905xxxxxxxxx).
- Mesaj gönderimi sırasında bilgisayarınızı kullanmayın, aksi takdirde otomatik işlemler kesintiye uğrayabilir.

## Sorun Giderme

- Eğer mesaj gönderilmiyorsa, WhatsApp Web'e giriş yaptığınızdan emin olun.
- Tarayıcı otomatik olarak kapanmıyorsa, manuel olarak kapatabilirsiniz.
- CSV dosyasında hata alıyorsanız, dosya formatının doğru olduğundan emin olun.

![wp1](https://github.com/user-attachments/assets/b82c7fc0-e4d3-4971-a015-b362890f886f)
![wp2](https://github.com/user-attachments/assets/983b4dcf-2c16-4367-ba1c-9d58e8455da6)





