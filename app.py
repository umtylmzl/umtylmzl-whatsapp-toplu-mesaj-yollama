import os
import csv
import json
import tempfile
import webbrowser
import threading
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import time
import logging
from datetime import datetime
import re
import pyautogui
import base64
from io import BytesIO
from PIL import Image, ImageGrab
import random

# WhatsApp gönderici modülünü içe aktar
from whatsapp_sender import send_whatsapp_message, load_recipients_from_csv, send_bulk_messages, close_browser_after_delay

# Flask uygulaması oluştur
app = Flask(__name__, static_folder='.', static_url_path='')
# CORS desteği ekle
CORS(app)

# Loglama ayarları
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(f"app_{datetime.now().strftime('%Y%m%d')}.log")
    ]
)
logger = logging.getLogger(__name__)

# Tarayıcıyı açma fonksiyonu
def open_browser():
    time.sleep(1.5)  # Sunucu başlatılana kadar bekle
    webbrowser.open('http://localhost:5000')

# Ana sayfa
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# Tek mesaj gönderme
@app.route('/send-message')
def send_message():
    try:
        # URL parametrelerini al
        phone = request.args.get('phone', '')
        message = request.args.get('message', '')
        repeat = int(request.args.get('repeat', 1))
        wait_time = int(request.args.get('wait_time', 3))
        close_time = int(request.args.get('close_time', 10))
        
        if not phone or not message:
            return jsonify({'success': False, 'error': 'Telefon numarası ve mesaj gereklidir'})
        
        # Telefon numarasını formatla
        if not phone.startswith('+'):
            phone = '+' + phone
        
        # Mesajı belirtilen sayıda tekrarla
        formatted_messages = []
        for i in range(repeat):
            msg = message
            if repeat > 1:
                msg = f"{message} ({i+1}/{repeat})"
            formatted_messages.append((phone, msg))
        
        # İşlem durumunu sıfırla
        reset_process_status()
        
        # Arka planda mesaj gönderme işlemini başlat
        thread = threading.Thread(target=send_messages_thread, args=(formatted_messages, wait_time, close_time))
        thread.daemon = True
        thread.start()
        
        return jsonify({'success': True, 'message': 'Mesaj gönderme işlemi başlatıldı'})
    
    except Exception as e:
        logger.error(f"Mesaj gönderme hatası: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# Toplu mesaj gönderme
@app.route('/send-bulk-messages', methods=['POST'])
def send_bulk_messages_route():
    try:
        # Form verilerini al
        csv_file = request.files.get('csv_file')
        default_message = request.form.get('default_message', '')
        repeat = int(request.form.get('repeat', 1))
        wait_time = int(request.form.get('wait_time', 3))
        close_time = int(request.form.get('close_time', 10))
        
        if not csv_file:
            return jsonify({'success': False, 'error': 'CSV dosyası gereklidir'})
        
        # Geçici dosya oluştur
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.csv')
        csv_file.save(temp_file.name)
        temp_file.close()
        
        # İşlem durumunu sıfırla
        reset_process_status()
        
        # Arka planda toplu mesaj gönderme işlemini başlat
        thread = threading.Thread(target=send_bulk_messages_thread, args=(temp_file.name, default_message, repeat, wait_time, close_time))
        thread.daemon = True
        thread.start()
        
        return jsonify({'success': True, 'message': 'Toplu mesaj gönderme işlemi başlatıldı'})
    
    except Exception as e:
        logger.error(f"Toplu mesaj gönderme hatası: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# WhatsApp kişilerini getir
@app.route('/get-contacts')
def get_contacts():
    try:
        logger.info("WhatsApp kişileri getiriliyor...")
        
        # Boş kişi listesi döndür
        contacts = []
        
        logger.info("Kişi listesi boş döndürüldü.")
        
        return jsonify({
            'success': True,
            'contacts': contacts
        })
    
    except Exception as e:
        logger.error(f"Kişileri getirme hatası: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# Seçilen kişilere mesaj gönder
@app.route('/send-to-contacts', methods=['POST'])
def send_to_contacts():
    try:
        # Form verilerini al
        contacts_json = request.form.get('contacts', '[]')
        message = request.form.get('message', '')
        repeat = int(request.form.get('repeat', 1))
        wait_time = int(request.form.get('wait_time', 3))
        close_time = int(request.form.get('close_time', 10))
        
        if not contacts_json or not message:
            return jsonify({'success': False, 'error': 'Kişiler ve mesaj gereklidir'})
        
        # JSON'dan kişileri yükle
        try:
            contacts = json.loads(contacts_json)
        except json.JSONDecodeError:
            return jsonify({'success': False, 'error': 'Geçersiz kişi verisi'})
        
        if not contacts:
            return jsonify({'success': False, 'error': 'Kişi listesi boş'})
        
        # Mesajı belirtilen sayıda tekrarla
        formatted_messages = []
        for contact in contacts:
            phone = contact.get('number', '')
            name = contact.get('name', '')
            
            # Telefon numarasını kontrol et
            if not phone:
                continue
                
            for i in range(repeat):
                msg = message
                if repeat > 1:
                    msg = f"{message} ({i+1}/{repeat})"
                formatted_messages.append((phone, msg, name))
        
        # İşlem durumunu sıfırla
        reset_process_status()
        
        # Arka planda mesaj gönderme işlemini başlat
        thread = threading.Thread(target=send_messages_thread, args=(formatted_messages, wait_time, close_time))
        thread.daemon = True
        thread.start()
        
        return jsonify({'success': True, 'message': 'Mesaj gönderme işlemi başlatıldı'})
    
    except Exception as e:
        logger.error(f"Kişilere mesaj gönderme hatası: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

# Örnek kişiler oluştur (artık kullanılmıyor)
def generate_sample_contacts():
    # Boş liste döndür
    return []

# Mesaj gönderme durumunu kontrol et
@app.route('/status')
def check_status():
    global current_progress, total_messages, success_count, failed_count, is_paused, is_stopped
    
    return jsonify({
        'success': True,
        'progress': current_progress,
        'total': total_messages,
        'success_count': success_count,
        'failed_count': failed_count,
        'is_paused': is_paused,
        'is_stopped': is_stopped
    })

# İşlemi durdur
@app.route('/pause')
def pause_process():
    global is_paused
    is_paused = True
    logger.info("İşlem duraklatıldı.")
    return jsonify({'success': True, 'message': 'İşlem duraklatıldı'})

# İşleme devam et
@app.route('/resume')
def resume_process():
    global is_paused
    is_paused = False
    logger.info("İşleme devam ediliyor.")
    return jsonify({'success': True, 'message': 'İşleme devam ediliyor'})

# İşlemi iptal et
@app.route('/stop')
def stop_process():
    global is_stopped
    is_stopped = True
    logger.info("İşlem iptal edildi.")
    return jsonify({'success': True, 'message': 'İşlem iptal edildi'})

# Global değişkenler
current_progress = 0
total_messages = 0
success_count = 0
failed_count = 0
is_paused = False
is_stopped = False

# İşlem durumunu sıfırla
def reset_process_status():
    global current_progress, total_messages, success_count, failed_count, is_paused, is_stopped
    current_progress = 0
    total_messages = 0
    success_count = 0
    failed_count = 0
    is_paused = False
    is_stopped = False

# Arka planda çalışacak mesaj gönderme işlevi
def send_messages_thread(messages, wait_time, close_time):
    global current_progress, total_messages, success_count, failed_count, is_paused, is_stopped
    
    current_progress = 0
    total_messages = len(messages)
    success_count = 0
    failed_count = 0
    
    try:
        for phone, message in messages:
            # İşlem durdurulduysa bekle
            while is_paused and not is_stopped:
                time.sleep(0.5)
                
            # İşlem iptal edildiyse çık
            if is_stopped:
                logger.info("İşlem kullanıcı tarafından iptal edildi.")
                break
                
            result = send_whatsapp_message(phone, message, wait_time)
            
            if result:
                success_count += 1
            else:
                failed_count += 1
                
            current_progress += 1
            
            # Son mesaj değilse ve işlem devam ediyorsa kısa bir bekleme
            if current_progress < total_messages and not is_stopped:
                time.sleep(1)
        
        # İşlem tamamlandıktan ve iptal edilmediyse tarayıcıyı kapat
        if not is_stopped:
            close_browser_after_delay(close_time)
        
    except Exception as e:
        logger.error(f"Mesaj gönderme thread hatası: {str(e)}")

# Arka planda çalışacak toplu mesaj gönderme işlevi
def send_bulk_messages_thread(csv_file, default_message, repeat, wait_time, close_time):
    global current_progress, total_messages, success_count, failed_count, is_paused, is_stopped
    
    current_progress = 0
    success_count = 0
    failed_count = 0
    
    try:
        # CSV'den alıcıları yükle
        recipients = load_recipients_from_csv(csv_file)
        
        # Geçici dosyayı sil
        os.unlink(csv_file)
        
        if not recipients:
            logger.error("Alıcı listesi boş veya CSV dosyası okunamadı.")
            return
        
        # Alıcı listesini düzenle
        formatted_recipients = []
        for phone, message in recipients:
            for i in range(repeat):
                msg = message or default_message
                if repeat > 1:
                    msg = f"{msg} ({i+1}/{repeat})"
                formatted_recipients.append((phone, msg))
        
        total_messages = len(formatted_recipients)
        
        # Mesajları gönder
        for index, (phone, message) in enumerate(formatted_recipients, 1):
            # İşlem durdurulduysa bekle
            while is_paused and not is_stopped:
                time.sleep(0.5)
                
            # İşlem iptal edildiyse çık
            if is_stopped:
                logger.info("İşlem kullanıcı tarafından iptal edildi.")
                break
                
            result = send_whatsapp_message(phone, message, wait_time)
            
            if result:
                success_count += 1
            else:
                failed_count += 1
                
            current_progress += 1
            
            # Son mesaj değilse ve işlem devam ediyorsa kısa bir bekleme
            if index < total_messages and not is_stopped:
                time.sleep(1)
        
        # İşlem tamamlandıktan ve iptal edilmediyse tarayıcıyı kapat
        if not is_stopped:
            close_browser_after_delay(close_time)
        
    except Exception as e:
        logger.error(f"Toplu mesaj gönderme thread hatası: {str(e)}")

if __name__ == '__main__':
    # Tarayıcıyı açmak için bir thread başlat
    threading.Thread(target=open_browser).start()
    
    # Flask uygulamasını başlat
    app.run(debug=False, port=5000, host='0.0.0.0') 