import argparse
import csv
import logging
import os
import sys
import time
from datetime import datetime
import webbrowser
import pyautogui
import threading

import pywhatkit as kit

# Loglama ayarları
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(f"whatsapp_{datetime.now().strftime('%Y%m%d')}.log")
    ]
)
logger = logging.getLogger(__name__)

# pywhatkit'in tarayıcı yönlendirmesini devre dışı bırak
kit.core.check_window = lambda: None

# pywhatkit'in tarayıcı yönlendirme fonksiyonunu geçersiz kıl
original_open_web = webbrowser.open
def custom_open_web(url):
    # Sadece WhatsApp Web URL'sini aç, diğerlerini engelle
    if "web.whatsapp.com" in url:
        return original_open_web(url)
    return True

# Özel webbrowser.open fonksiyonunu ayarla
webbrowser.open = custom_open_web

def load_recipients_from_csv(file_path):
    """
    CSV dosyasından alıcıları yükler
    
    Args:
        file_path (str): CSV dosyasının yolu
        
    Returns:
        list: (telefon_numarası, mesaj) tuple'larından oluşan liste
    """
    recipients = []
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            reader = csv.reader(file)
            header = next(reader)  # Başlık satırını atla
            
            # Sütun indekslerini belirle
            phone_idx = header.index('phone')
            message_idx = header.index('message') if 'message' in header else None
            
            for row in reader:
                if len(row) <= phone_idx:
                    logger.warning(f"Geçersiz satır: {row}")
                    continue
                    
                phone = row[phone_idx].strip()
                # Telefon numarasını düzenle (başında + varsa kaldır)
                if phone.startswith('+'):
                    phone = phone[1:]
                
                # Özel mesaj varsa kullan, yoksa None olarak bırak
                message = row[message_idx] if message_idx is not None and len(row) > message_idx else None
                recipients.append((phone, message))
                
        logger.info(f"{len(recipients)} alıcı yüklendi.")
        return recipients
    except Exception as e:
        logger.error(f"CSV dosyası yüklenirken hata: {str(e)}")
        return []

def save_results(results, output_file=None):
    """
    Gönderim sonuçlarını kaydeder
    
    Args:
        results (dict): Başarılı ve başarısız gönderimler
        output_file (str, optional): Çıktı dosyası yolu
    """
    if output_file is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"results_{timestamp}.csv"
        
    try:
        with open(output_file, 'w', encoding='utf-8', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(['phone', 'status'])
            
            for phone in results['success']:
                writer.writerow([phone, 'success'])
                
            for phone in results['failed']:
                writer.writerow([phone, 'failed'])
                
        logger.info(f"Sonuçlar {output_file} dosyasına kaydedildi.")
        return output_file
    except Exception as e:
        logger.error(f"Sonuçlar kaydedilirken hata: {str(e)}")
        return None

def disable_redirect():
    # Orijinal check_window fonksiyonunu yedekle
    original_check_window = kit.core.check_window
    
    # Yeni check_window fonksiyonu
    def new_check_window():
        pass
    
    # Orijinal fonksiyonu geçersiz kıl
    kit.core.check_window = new_check_window

def close_browser_after_delay(delay_seconds=10):
    def close_browser():
        logger.info(f"{delay_seconds} saniye sonra tarayıcı kapatılacak...")
        time.sleep(delay_seconds)
        try:
            # Alt+F4 tuş kombinasyonu ile aktif pencereyi kapat
            pyautogui.hotkey('alt', 'f4')
            logger.info("Tarayıcı başarıyla kapatıldı.")
        except Exception as e:
            logger.error(f"Tarayıcı kapatılırken hata oluştu: {str(e)}")
    
    # Tarayıcıyı kapatmak için yeni bir thread başlat
    thread = threading.Thread(target=close_browser)
    thread.daemon = True
    thread.start()

def send_whatsapp_message(phone, message, wait_time=3):
    """
    pywhatkit kullanarak WhatsApp mesajı gönderir
    
    Args:
        phone (str): Telefon numarası
        message (str): Gönderilecek mesaj
        wait_time (int): Mesaj gönderme öncesi bekleme süresi
        
    Returns:
        bool: Başarılı ise True, değilse False
    """
    try:
        # Telefon numarasını formatla
        if not phone.startswith('+'):
            phone = '+' + phone
        
        # Tarayıcı yönlendirmesini devre dışı bırak
        disable_redirect()
        
        # Mesajı gönder
        logger.info(f"Mesaj gönderiliyor: {phone}")
        
        # Anlık mesaj gönderme (bekleme süresi olmadan)
        kit.sendwhatmsg_instantly(
            phone_no=phone,
            message=message,
            wait_time=wait_time,  # Mesaj gönderme öncesi bekleme süresi
            tab_close=False,
            close_time=0  # Tarayıcıyı kapatma (biz kendimiz yöneteceğiz)
        )
        
        logger.info(f"Mesaj başarıyla gönderildi: {phone}")
        return True
    except Exception as e:
        logger.error(f"Mesaj gönderme hatası ({phone}): {str(e)}")
        return False

def send_bulk_messages(recipients, wait_time=3):
    """
    Birden fazla alıcıya mesaj gönderir
    
    Args:
        recipients (list): Her biri (telefon_numarası, mesaj) tuple'ı olan liste
        wait_time (int): Mesajlar arasındaki bekleme süresi (saniye)
        
    Returns:
        dict: Başarılı ve başarısız gönderimler
    """
    results = {"success": [], "failed": []}
    
    total = len(recipients)
    print(f"\nToplam {total} mesaj gönderilecek.\n")
    
    for index, (phone, message) in enumerate(recipients, 1):
        print(f"İşlem: {index}/{total} - Numara: {phone}")
        
        if send_whatsapp_message(phone, message, wait_time):
            results["success"].append(phone)
        else:
            results["failed"].append(phone)
            
        # Son mesaj değilse ve bekleme süresi varsa bekle
        if index < total and wait_time > 0:
            print(f"Bir sonraki mesaj için {wait_time} saniye bekleniyor...")
            time.sleep(wait_time)
            
    # Sonuçları göster
    logger.info(f"Toplu mesaj gönderme tamamlandı. Başarılı: {len(results['success'])}, Başarısız: {len(results['failed'])}")
    
    return results

def start_web_interface():
    try:
        # app.py dosyasını çalıştır
        from app import app
        print("\n" + "="*50)
        print("WhatsApp Web Arayüzü Başlatılıyor")
        print("="*50)
        print("\nWeb tarayıcınızda http://localhost:5000 adresini açın")
        app.run(debug=False, port=5000)
    except Exception as e:
        logger.error(f"Web arayüzü başlatma hatası: {str(e)}")
        sys.exit(1)

def main():
    # Komut satırı argümanlarını işle
    parser = argparse.ArgumentParser(description='WhatsApp Toplu Mesaj Gönderici')
    parser.add_argument('--csv', help='Alıcıların bulunduğu CSV dosyası', default='recipients.csv')
    parser.add_argument('--message', help='Tüm alıcılara gönderilecek varsayılan mesaj', default='Merhaba, bu bir test mesajıdır.')
    parser.add_argument('--repeat', type=int, help='Her mesajın kaç kez tekrarlanacağı', default=1)
    parser.add_argument('--wait', type=int, help='Mesajlar arasındaki bekleme süresi (saniye)', default=0)
    parser.add_argument('--web', action='store_true', help='Web arayüzünü başlat')
    
    args = parser.parse_args()
    
    # Web arayüzünü başlat
    if args.web:
        start_web_interface()
    elif args.csv:
        # CSV dosyası kontrolü
        if not os.path.exists(args.csv):
            logger.error(f"CSV dosyası bulunamadı: {args.csv}")
            sys.exit(1)
        
        # CSV'den alıcıları yükle
        recipients = load_recipients_from_csv(args.csv)
        if not recipients:
            logger.error("Alıcı listesi boş veya CSV dosyası okunamadı.")
            sys.exit(1)
        
        # Alıcı listesini düzenle (özel mesajı olmayanlar için varsayılan mesajı kullan)
        formatted_recipients = []
        for phone, message in recipients:
            # Her alıcı için mesajı belirtilen adet kadar tekrarla
            for i in range(args.repeat):
                msg = message or args.message
                # Eğer birden fazla mesaj gönderiliyorsa, mesaja sıra numarası ekle
                if args.repeat > 1:
                    msg = f"{msg} ({i+1}/{args.repeat})"
                formatted_recipients.append((phone, msg))
        
        print("\n" + "="*50)
        print("WhatsApp Toplu Mesaj Gönderici")
        print("="*50)
        print("\nProgram başlatılıyor...")
        print("WhatsApp Web tarayıcıda açılacak ve mesajlar otomatik olarak gönderilecektir.")
        print("Lütfen telefonunuzun WhatsApp uygulamasında oturum açık olduğundan emin olun.")
        print("İlk mesaj gönderilmeden önce WhatsApp Web'e giriş yapmanız gerekebilir.")
        print("\nHazır olduğunuzda Enter tuşuna basın...")
        input()
        
        try:
            # Mesajları gönder
            results = send_bulk_messages(formatted_recipients, args.wait)
            
            # Sonuçları kaydet
            output_file = save_results(results)
            
            # İstatistikleri göster
            print("\n" + "="*50)
            print(f"Gönderim tamamlandı!")
            print(f"Başarılı: {len(results['success'])}, Başarısız: {len(results['failed'])}")
            if output_file:
                print(f"Sonuçlar {output_file} dosyasına kaydedildi.")
            print("="*50 + "\n")
            
            # İşlem tamamlandıktan sonra tarayıcıyı kapat
            close_browser_after_delay(10)
            
        except KeyboardInterrupt:
            logger.info("İşlem kullanıcı tarafından durduruldu.")
            print("\nİşlem kullanıcı tarafından durduruldu.")
        except Exception as e:
            logger.error(f"Beklenmeyen bir hata oluştu: {str(e)}")
            print(f"\nBeklenmeyen bir hata oluştu: {str(e)}")
    else:
        parser.print_help()

if __name__ == "__main__":
    main() 