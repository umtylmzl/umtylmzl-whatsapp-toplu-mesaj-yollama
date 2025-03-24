@echo off
echo WhatsApp Mesaj Gönderici Web Arayüzü başlatılıyor...
echo.
echo Tarayıcı otomatik olarak açılacak...
echo.
timeout /t 2 > nul
start http://localhost:5000
py whatsapp_sender.py --web
pause 