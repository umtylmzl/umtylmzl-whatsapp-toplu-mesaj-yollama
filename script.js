document.addEventListener('DOMContentLoaded', function() {
    // API temel URL'si
    const API_BASE_URL = 'http://localhost:5000';
    
    // Global değişkenler
    let isPaused = false;
    let isProcessing = false;
    let selectedContact = null;
    let contactsList = []; // Tüm kişileri saklayacak dizi
    let selectedContacts = []; // Toplu mesaj için seçilen kişileri saklayacak dizi
    
    // Sekme değiştirme işlevi
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Aktif sekme butonunu değiştir
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // İlgili içeriği göster
            const tabId = button.getAttribute('data-tab');
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });
            
            // Önizleme alanını temizle
            clearPreview();
        });
    });
    
    // Dosya seçme işlevi
    const csvFileInput = document.getElementById('csv-file');
    const fileNameSpan = document.getElementById('file-name');
    
    csvFileInput.addEventListener('change', function(e) {
        if (this.files.length > 0) {
            const fileName = this.files[0].name;
            fileNameSpan.textContent = fileName;
            
            // CSV dosyasını oku ve önizleme göster
            readCSVFile(this.files[0]);
        } else {
            fileNameSpan.textContent = 'Dosya seçilmedi';
            clearPreview();
        }
    });
    
    // Tek mesaj gönderme butonu
    const sendButton = document.getElementById('send-btn');
    sendButton.addEventListener('click', function(e) {
        // Sayfanın yenilenmesini önle
        e.preventDefault();
        
        if (isProcessing) {
            alert('Zaten bir işlem devam ediyor!');
            return;
        }
        
        const phone = document.getElementById('phone').value.trim();
        const message = document.getElementById('message').value.trim();
        const repeat = parseInt(document.getElementById('repeat').value) || 1;
        const waitTime = parseInt(document.getElementById('wait-time').value) || 3;
        const closeTime = parseInt(document.getElementById('close-time').value) || 10;
        
        if (!phone) {
            alert('Lütfen bir telefon numarası girin!');
            return;
        }
        
        if (!message) {
            alert('Lütfen bir mesaj girin!');
            return;
        }
        
        // Telefon numarası formatını kontrol et
        if (!isValidPhoneNumber(phone)) {
            alert('Geçersiz telefon numarası formatı! Örnek: 905xxxxxxxxx');
            return;
        }
        
        // Mesaj gönderme işlemini başlat
        sendMessage(phone, message, repeat, waitTime, closeTime);
    });
    
    // Toplu mesaj gönderme butonu
    const bulkSendButton = document.getElementById('bulk-send-btn');
    bulkSendButton.addEventListener('click', function(e) {
        // Sayfanın yenilenmesini önle
        e.preventDefault();
        
        if (isProcessing) {
            alert('Zaten bir işlem devam ediyor!');
            return;
        }
        
        const recipientsOption = document.querySelector('input[name="recipients-option"]:checked').value;
        const defaultMessage = document.getElementById('default-message').value.trim();
        const repeat = parseInt(document.getElementById('bulk-repeat').value) || 1;
        const waitTime = parseInt(document.getElementById('bulk-wait-time').value) || 3;
        const closeTime = parseInt(document.getElementById('bulk-close-time').value) || 10;
        
        if (recipientsOption === 'csv') {
            const csvFile = document.getElementById('csv-file').files[0];
            
            if (!csvFile) {
                alert('Lütfen bir CSV dosyası seçin!');
                return;
            }
            
            // CSV dosyasını oku ve mesaj gönderme işlemini başlat
            processCSVAndSend(csvFile, defaultMessage, repeat, waitTime, closeTime);
        } else if (recipientsOption === 'contacts') {
            if (selectedContacts.length === 0) {
                alert('Lütfen en az bir kişi seçin!');
                return;
            }
            
            if (!defaultMessage) {
                alert('Lütfen bir mesaj girin!');
                return;
            }
            
            // Seçilen kişilere mesaj gönderme işlemini başlat
            processSelectedContactsAndSend(selectedContacts, defaultMessage, repeat, waitTime, closeTime);
        }
    });
    
    // Alıcı seçenekleri değiştiğinde
    const recipientsOptions = document.querySelectorAll('input[name="recipients-option"]');
    recipientsOptions.forEach(option => {
        option.addEventListener('change', function() {
            const csvOption = document.getElementById('csv-option');
            const contactsOption = document.getElementById('contacts-option');
            
            if (this.value === 'csv') {
                csvOption.style.display = 'block';
                contactsOption.style.display = 'none';
                
                // CSV dosyası seçilmişse önizlemeyi güncelle
                const csvFile = document.getElementById('csv-file').files[0];
                if (csvFile) {
                    readCSVFile(csvFile);
                } else {
                    clearPreview();
                }
            } else if (this.value === 'contacts') {
                csvOption.style.display = 'none';
                contactsOption.style.display = 'block';
                
                // Seçilen kişiler varsa önizlemeyi güncelle
                if (selectedContacts.length > 0) {
                    updateSelectedContactsPreview();
                } else {
                    clearPreview();
                }
            }
        });
    });
    
    // Telefon numarası girişi için tek mesaj önizleme
    const phoneInput = document.getElementById('phone');
    const messageInput = document.getElementById('message');
    
    phoneInput.addEventListener('input', updateSinglePreview);
    messageInput.addEventListener('input', updateSinglePreview);
    
    // Kontrol butonları
    const pauseButton = document.getElementById('pause-btn');
    const resumeButton = document.getElementById('resume-btn');
    const stopButton = document.getElementById('stop-btn');
    const controlButtons = document.querySelector('.control-buttons');
    
    pauseButton.addEventListener('click', function() {
        isPaused = true;
        pauseButton.style.display = 'none';
        resumeButton.style.display = 'inline-block';
        
        // Sunucuya durdurma isteği gönder
        fetch(`${API_BASE_URL}/pause`)
            .catch(error => {
                console.error('Durdurma hatası:', error);
            });
    });
    
    resumeButton.addEventListener('click', function() {
        isPaused = false;
        resumeButton.style.display = 'none';
        pauseButton.style.display = 'inline-block';
        
        // Sunucuya devam etme isteği gönder
        fetch(`${API_BASE_URL}/resume`)
            .catch(error => {
                console.error('Devam etme hatası:', error);
            });
    });
    
    stopButton.addEventListener('click', function() {
        if (confirm('İşlemi iptal etmek istediğinize emin misiniz?')) {
            // Sunucuya iptal isteği gönder
            fetch(`${API_BASE_URL}/stop`)
                .then(() => {
                    resetUI();
                })
                .catch(error => {
                    console.error('İptal hatası:', error);
                    resetUI();
                });
        }
    });
    
    // İşlem tamamlandı sayfası
    const newMessageButton = document.getElementById('new-message-btn');
    
    newMessageButton.addEventListener('click', function() {
        // Ana sayfaya dön
        document.getElementById('main-container').style.display = 'block';
        document.getElementById('completion-container').style.display = 'none';
        resetUI();
    });
    
    // Kişi Seçme Modalı
    const modal = document.getElementById('contact-modal');
    const selectContactBtn = document.getElementById('select-contact-btn');
    const closeModalBtn = document.querySelector('.close');
    const selectContactConfirmBtn = document.getElementById('select-contact-confirm-btn');
    const refreshContactsBtn = document.getElementById('refresh-contacts-btn');
    const contactSearchInput = document.getElementById('contact-search');
    const contactList = document.getElementById('contact-list');
    const showSampleContactsBtn = document.getElementById('show-sample-contacts-btn');
    const importContactsBtn = document.getElementById('import-contacts-btn');
    const contactsFileInput = document.getElementById('contacts-file');
    const contactsFileName = document.getElementById('contacts-file-name');
    const bulkSelectContactBtn = document.getElementById('bulk-select-contact-btn');
    
    // Kişi seçme butonuna tıklandığında
    selectContactBtn.addEventListener('click', function() {
        // Modalı göster
        modal.style.display = 'block';
        
        // Kişi listesini temizle
        contactList.innerHTML = '<p class="info-message">Lütfen rehber dosyası yükleyin veya örnek kişileri göstermek için butona tıklayın.</p>';
        
        // Tek kişi seçme modunu etkinleştir
        selectContactConfirmBtn.dataset.mode = 'single';
        selectContactConfirmBtn.textContent = 'Kişiyi Seç';
    });
    
    // Toplu mesaj için kişi seçme butonuna tıklandığında
    if (bulkSelectContactBtn) {
        bulkSelectContactBtn.addEventListener('click', function() {
            // Modalı göster
            modal.style.display = 'block';
            
            // Kişi listesini temizle
            contactList.innerHTML = '<p class="info-message">Lütfen rehber dosyası yükleyin veya örnek kişileri göstermek için butona tıklayın.</p>';
            
            // Çoklu kişi seçme modunu etkinleştir
            selectContactConfirmBtn.dataset.mode = 'multiple';
            selectContactConfirmBtn.textContent = 'Seçilen Kişileri Ekle';
            
            // Eğer daha önce seçilmiş kişiler varsa, onları işaretle
            if (contactsList.length > 0) {
                displayContacts(contactsList, true);
            }
        });
    }
    
    // Rehber dosyası seçildiğinde
    contactsFileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            contactsFileName.textContent = this.files[0].name;
        } else {
            contactsFileName.textContent = 'Dosya seçilmedi';
        }
    });
    
    // Rehberi içe aktar butonuna tıklandığında
    importContactsBtn.addEventListener('click', function() {
        const file = contactsFileInput.files[0];
        if (!file) {
            alert('Lütfen önce bir rehber dosyası seçin!');
            return;
        }
        
        // Yükleniyor mesajını göster
        contactList.innerHTML = '<p class="loading-message">Rehber dosyası işleniyor...</p>';
        
        // Dosya uzantısını kontrol et
        const fileExtension = file.name.split('.').pop().toLowerCase();
        
        if (fileExtension === 'csv') {
            // CSV dosyasını işle
            processCSVContacts(file);
        } else if (fileExtension === 'vcf') {
            // VCF dosyasını işle
            processVCFContacts(file);
        } else {
            contactList.innerHTML = '<p class="info-message">Desteklenmeyen dosya formatı. Lütfen CSV veya VCF dosyası yükleyin.</p>';
        }
    });
    
    // CSV rehber dosyasını işle
    function processCSVContacts(file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const content = e.target.result;
            const lines = content.split('\n');
            
            // Kişileri saklamak için dizi
            const contacts = [];
            
            // CSV başlık satırını kontrol et
            if (lines.length > 0) {
                const headers = lines[0].split(',');
                
                // İsim ve telefon sütunlarını bul
                let nameIndex = -1;
                let phoneIndex = -1;
                
                headers.forEach((header, index) => {
                    const headerText = header.trim().toLowerCase();
                    if (headerText === 'name' || headerText === 'isim' || headerText === 'ad') {
                        nameIndex = index;
                    } else if (headerText === 'phone' || headerText === 'telefon' || headerText === 'numara') {
                        phoneIndex = index;
                    }
                });
                
                // Telefon sütunu bulunamadıysa hata göster
                if (phoneIndex === -1) {
                    contactList.innerHTML = '<p class="info-message">CSV dosyasında telefon numarası sütunu bulunamadı. Sütun başlığı "phone", "telefon" veya "numara" olmalıdır.</p>';
                    return;
                }
                
                // İsim sütunu bulunamadıysa, telefon numarasını isim olarak kullan
                for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim() === '') continue;
                    
                    const columns = lines[i].split(',');
                    
                    // Telefon numarasını al ve formatla
                    let phone = columns[phoneIndex]?.trim() || '';
                    if (phone) {
                        // Telefon numarasını formatla (başında + yoksa ekle)
                        if (!phone.startsWith('+')) {
                            phone = '+' + phone;
                        }
                        
                        // İsmi al veya telefon numarasını kullan
                        const name = (nameIndex !== -1 && columns[nameIndex]) 
                            ? columns[nameIndex].trim() 
                            : `Kişi ${i}`;
                        
                        contacts.push({
                            name: name,
                            number: phone
                        });
                    }
                }
                
                // Kişileri global değişkene kaydet
                contactsList = contacts;
                
                // Kişileri göster
                displayContacts(contacts);
            } else {
                contactList.innerHTML = '<p class="info-message">CSV dosyası boş veya geçersiz.</p>';
            }
        };
        
        reader.onerror = function() {
            contactList.innerHTML = '<p class="info-message">Dosya okuma hatası.</p>';
        };
        
        reader.readAsText(file);
    }
    
    // VCF rehber dosyasını işle
    function processVCFContacts(file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const content = e.target.result;
            
            // VCF kişilerini ayır
            const vcfCards = content.split('BEGIN:VCARD');
            
            // Kişileri saklamak için dizi
            const contacts = [];
            
            // Her VCF kartını işle
            for (let i = 1; i < vcfCards.length; i++) {
                const card = vcfCards[i];
                
                // İsim ve telefon numarasını bul
                const nameMatch = card.match(/FN:(.*?)(?:\r\n|\r|\n)/);
                const phoneMatches = card.match(/TEL[^:]*:(.*?)(?:\r\n|\r|\n)/g);
                
                if (phoneMatches && phoneMatches.length > 0) {
                    // İlk telefon numarasını al
                    let phone = phoneMatches[0].split(':')[1].trim();
                    
                    // Telefon numarasını formatla (başında + yoksa ekle)
                    if (!phone.startsWith('+')) {
                        phone = '+' + phone;
                    }
                    
                    // İsmi al veya telefon numarasını kullan
                    const name = nameMatch ? nameMatch[1].trim() : `Kişi ${i}`;
                    
                    contacts.push({
                        name: name,
                        number: phone
                    });
                }
            }
            
            // Kişileri global değişkene kaydet
            contactsList = contacts;
            
            // Kişileri göster
            displayContacts(contacts);
        };
        
        reader.onerror = function() {
            contactList.innerHTML = '<p class="info-message">Dosya okuma hatası.</p>';
        };
        
        reader.readAsText(file);
    }
    
    // Örnek kişileri göster butonuna tıklandığında
    showSampleContactsBtn.addEventListener('click', function() {
        fetchWhatsAppContacts();
    });
    
    // Modalı kapatma
    closeModalBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    // Modalın dışına tıklandığında kapat
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Kişileri yenileme butonu
    refreshContactsBtn.addEventListener('click', function() {
        fetchWhatsAppContacts();
    });
    
    // Kişi arama
    contactSearchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const contactItems = contactList.querySelectorAll('.contact-item');
        
        contactItems.forEach(item => {
            const name = item.querySelector('.contact-name').textContent.toLowerCase();
            const number = item.querySelector('.contact-number').textContent.toLowerCase();
            
            if (name.includes(searchTerm) || number.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });
    
    // Kişi seçme onaylama butonu
    selectContactConfirmBtn.addEventListener('click', function() {
        const mode = this.dataset.mode || 'single';
        
        if (mode === 'single') {
            // Tek kişi seçme modu
            if (selectedContact) {
                // Seçilen kişinin numarasını telefon alanına yaz
                document.getElementById('phone').value = selectedContact.number.replace('+', '');
                
                // Önizlemeyi güncelle
                updateSinglePreview();
                
                // Modalı kapat
                modal.style.display = 'none';
            } else {
                alert('Lütfen bir kişi seçin!');
            }
        } else if (mode === 'multiple') {
            // Çoklu kişi seçme modu
            const selectedItems = contactList.querySelectorAll('.contact-item.selected');
            
            if (selectedItems.length === 0) {
                alert('Lütfen en az bir kişi seçin!');
                return;
            }
            
            // Seçilen kişileri kaydet
            selectedContacts = [];
            selectedItems.forEach(item => {
                const index = parseInt(item.dataset.index);
                selectedContacts.push(contactsList[index]);
            });
            
            // Önizlemeyi güncelle
            updateSelectedContactsPreview();
            
            // Modalı kapat
            modal.style.display = 'none';
        }
    });
    
    // WhatsApp kişilerini getir
    function fetchWhatsAppContacts() {
        // Yükleniyor mesajını göster
        contactList.innerHTML = '<p class="loading-message">WhatsApp kişileri getiriliyor...</p>';
        selectedContact = null;
        
        // Sunucudan kişileri getir
        fetch(`${API_BASE_URL}/get-contacts`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.contacts && data.contacts.length > 0) {
                    displayContacts(data.contacts);
                } else {
                    contactList.innerHTML = '<p class="info-message">Hiç kişi bulunamadı. Lütfen rehber dosyası yükleyin.</p>';
                }
            })
            .catch(error => {
                console.error('Kişileri getirme hatası:', error);
                contactList.innerHTML = '<p class="info-message">Kişiler getirilirken bir hata oluştu.</p>';
            });
    }
    
    // Kişileri görüntüle
    function displayContacts(contacts, isMultipleSelect = false) {
        if (!contacts || contacts.length === 0) {
            contactList.innerHTML = '<p class="info-message">Hiç kişi bulunamadı. Lütfen rehber dosyası yükleyin.</p>';
            return;
        }
        
        // Kişi listesini temizle
        contactList.innerHTML = '';
        
        // Tüm kişileri seç/kaldır butonu ekle
        const selectAllContainer = document.createElement('div');
        selectAllContainer.className = 'select-all-container';
        
        const selectAllBtn = document.createElement('button');
        selectAllBtn.className = 'btn-secondary select-all-btn';
        selectAllBtn.innerHTML = '<i class="fas fa-check-square"></i> Tümünü Seç';
        
        const clearAllBtn = document.createElement('button');
        clearAllBtn.className = 'btn-secondary clear-all-btn';
        clearAllBtn.innerHTML = '<i class="fas fa-trash"></i> Tümünü Temizle';
        
        selectAllContainer.appendChild(selectAllBtn);
        selectAllContainer.appendChild(clearAllBtn);
        contactList.appendChild(selectAllContainer);
        
        // Tümünü seç butonuna tıklandığında
        selectAllBtn.addEventListener('click', function() {
            const contactItems = contactList.querySelectorAll('.contact-item');
            contactItems.forEach(item => {
                item.classList.add('selected');
            });
        });
        
        // Tümünü temizle butonuna tıklandığında
        clearAllBtn.addEventListener('click', function() {
            if (confirm('Tüm kişileri silmek istediğinize emin misiniz?')) {
                contactsList = [];
                contactList.innerHTML = '<p class="info-message">Tüm kişiler silindi.</p>';
                selectedContact = null;
                selectedContacts = [];
            }
        });
        
        // Kişileri listele
        contacts.forEach((contact, index) => {
            const contactItem = document.createElement('div');
            contactItem.className = 'contact-item';
            contactItem.dataset.index = index;
            
            // Eğer çoklu seçim modundaysa ve bu kişi daha önce seçilmişse, seçili olarak işaretle
            if (isMultipleSelect && selectedContacts.some(c => c.number === contact.number)) {
                contactItem.classList.add('selected');
            }
            
            // Kişi avatarı (baş harflerini kullan)
            const initials = getInitials(contact.name);
            
            contactItem.innerHTML = `
                <div class="contact-avatar">${initials}</div>
                <div class="contact-info">
                    <div class="contact-name">${contact.name}</div>
                    <div class="contact-number">${contact.number}</div>
                </div>
                <div class="contact-actions">
                    <button class="delete-contact-btn" title="Kişiyi Sil"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            // Kişiye tıklandığında seçme
            contactItem.addEventListener('click', function(e) {
                // Silme butonuna tıklandıysa işlemi durdur
                if (e.target.closest('.delete-contact-btn')) {
                    return;
                }
                
                const mode = selectContactConfirmBtn.dataset.mode || 'single';
                
                if (mode === 'single') {
                    // Tek kişi seçme modu
                    // Önceki seçimi kaldır
                    const selectedItems = contactList.querySelectorAll('.contact-item.selected');
                    selectedItems.forEach(item => item.classList.remove('selected'));
                    
                    // Yeni seçimi işaretle
                    this.classList.add('selected');
                    
                    // Seçilen kişiyi kaydet
                    selectedContact = contact;
                } else if (mode === 'multiple') {
                    // Çoklu kişi seçme modu
                    // Seçimi değiştir
                    this.classList.toggle('selected');
                }
            });
            
            // Silme butonuna tıklandığında
            const deleteBtn = contactItem.querySelector('.delete-contact-btn');
            deleteBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                
                if (confirm(`"${contact.name}" kişisini silmek istediğinize emin misiniz?`)) {
                    // Kişiyi listeden kaldır
                    contactsList.splice(index, 1);
                    
                    // Kişi listesini yeniden göster
                    displayContacts(contactsList, selectContactConfirmBtn.dataset.mode === 'multiple');
                    
                    // Eğer seçilen kişi silinmişse, seçimi temizle
                    if (selectedContact && selectedContact.number === contact.number) {
                        selectedContact = null;
                    }
                    
                    // Eğer seçilen kişiler arasında silinmişse, onu da kaldır
                    selectedContacts = selectedContacts.filter(c => c.number !== contact.number);
                }
            });
            
            contactList.appendChild(contactItem);
        });
    }
    
    // İsmin baş harflerini al
    function getInitials(name) {
        if (!name) return '?';
        
        const words = name.split(' ');
        if (words.length === 1) {
            return words[0].charAt(0).toUpperCase();
        } else {
            return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
        }
    }
    
    // Yardımcı fonksiyonlar
    function isValidPhoneNumber(phone) {
        // Basit bir telefon numarası doğrulama (ülke kodu + numara)
        return /^[0-9]{10,15}$/.test(phone);
    }
    
    function clearPreview() {
        const previewElement = document.getElementById('recipients-preview');
        previewElement.innerHTML = '<p class="empty-message">Henüz alıcı eklenmedi.</p>';
    }
    
    function updateSinglePreview() {
        const phone = phoneInput.value.trim();
        const message = messageInput.value.trim();
        
        if (phone) {
            const previewElement = document.getElementById('recipients-preview');
            previewElement.innerHTML = `
                <div class="recipient-item">
                    <strong>${phone}</strong>
                    <p>${message || 'Mesaj girilmedi'}</p>
                </div>
            `;
        } else {
            clearPreview();
        }
    }
    
    function readCSVFile(file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const content = e.target.result;
            const lines = content.split('\n');
            
            // CSV başlık satırını kontrol et
            if (lines.length > 0) {
                const headers = lines[0].split(',');
                const phoneIndex = headers.findIndex(h => h.trim().toLowerCase() === 'phone');
                const messageIndex = headers.findIndex(h => h.trim().toLowerCase() === 'message');
                
                if (phoneIndex === -1) {
                    alert('CSV dosyasında "phone" sütunu bulunamadı!');
                    clearPreview();
                    return;
                }
                
                // Önizleme göster
                showCSVPreview(lines, phoneIndex, messageIndex);
            }
        };
        
        reader.readAsText(file);
    }
    
    function showCSVPreview(lines, phoneIndex, messageIndex) {
        const previewElement = document.getElementById('recipients-preview');
        previewElement.innerHTML = '';
        
        // En fazla 5 satır göster
        const maxPreviewLines = Math.min(6, lines.length);
        
        for (let i = 1; i < maxPreviewLines; i++) {
            if (lines[i].trim() === '') continue;
            
            const columns = lines[i].split(',');
            const phone = columns[phoneIndex]?.trim() || '';
            const message = (messageIndex !== -1 && columns[messageIndex]) ? columns[messageIndex].trim() : 'Varsayılan mesaj kullanılacak';
            
            if (phone) {
                const recipientItem = document.createElement('div');
                recipientItem.className = 'recipient-item';
                recipientItem.innerHTML = `
                    <strong>${phone}</strong>
                    <p>${message}</p>
                `;
                previewElement.appendChild(recipientItem);
            }
        }
        
        // Daha fazla satır varsa belirt
        if (lines.length > 6) {
            const moreInfo = document.createElement('p');
            moreInfo.textContent = `... ve ${lines.length - 6} alıcı daha`;
            moreInfo.style.textAlign = 'center';
            moreInfo.style.marginTop = '10px';
            moreInfo.style.fontStyle = 'italic';
            previewElement.appendChild(moreInfo);
        }
    }
    
    function sendMessage(phone, message, repeat, waitTime, closeTime) {
        // İşlem durumunu güncelle
        isProcessing = true;
        
        // Durum göstergesini göster
        const statusElement = document.getElementById('status');
        const progressBar = document.querySelector('.progress-bar');
        const statusText = document.querySelector('.status-text');
        
        statusElement.style.display = 'block';
        progressBar.style.width = '0%';
        statusText.textContent = 'WhatsApp Web hazırlanıyor...';
        
        // Kontrol butonlarını göster
        controlButtons.style.display = 'flex';
        
        // Python betiğini çağır
        const params = new URLSearchParams();
        params.append('phone', phone);
        params.append('message', message);
        params.append('repeat', repeat);
        params.append('wait_time', waitTime);
        params.append('close_time', closeTime);
        
        fetch(`${API_BASE_URL}/send-message?` + params.toString())
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Durum kontrolünü başlat
                    startStatusCheck();
                } else {
                    progressBar.style.width = '100%';
                    statusText.textContent = 'Hata: ' + data.error;
                    resetUI();
                }
            })
            .catch(error => {
                console.error('Hata:', error);
                progressBar.style.width = '100%';
                statusText.textContent = 'Bir hata oluştu: ' + error.message;
                resetUI();
            });
    }
    
    function processCSVAndSend(file, defaultMessage, repeat, waitTime, closeTime) {
        // İşlem durumunu güncelle
        isProcessing = true;
        
        // Durum göstergesini göster
        const statusElement = document.getElementById('status');
        const progressBar = document.querySelector('.progress-bar');
        const statusText = document.querySelector('.status-text');
        
        statusElement.style.display = 'block';
        progressBar.style.width = '0%';
        statusText.textContent = 'CSV dosyası yükleniyor...';
        
        // Kontrol butonlarını göster
        controlButtons.style.display = 'flex';
        
        // FormData oluştur
        const formData = new FormData();
        formData.append('csv_file', file);
        formData.append('default_message', defaultMessage);
        formData.append('repeat', repeat);
        formData.append('wait_time', waitTime);
        formData.append('close_time', closeTime);
        
        // Python betiğini çağır
        fetch(`${API_BASE_URL}/send-bulk-messages`, {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Durum kontrolünü başlat
                    startStatusCheck();
                } else {
                    progressBar.style.width = '100%';
                    statusText.textContent = 'Hata: ' + data.error;
                    resetUI();
                }
            })
            .catch(error => {
                console.error('Hata:', error);
                progressBar.style.width = '100%';
                statusText.textContent = 'Bir hata oluştu: ' + error.message;
                resetUI();
            });
    }
    
    function updateProgress(current, total, successCount, failedCount) {
        const progressBar = document.querySelector('.progress-bar');
        const statusText = document.querySelector('.status-text');
        const percentage = (current / total) * 100;
        
        progressBar.style.width = percentage + '%';
        statusText.textContent = `İşleniyor: ${current}/${total} mesaj gönderildi (${successCount} başarılı, ${failedCount} başarısız)`;
        
        // İşlem tamamlandıysa
        if (current === total && total > 0) {
            showCompletionPage(successCount, failedCount);
        }
    }
    
    function showCompletionPage(successCount, failedCount) {
        // İşlem durumunu güncelle
        isProcessing = false;
        
        // İstatistikleri güncelle
        document.getElementById('success-count').textContent = successCount;
        document.getElementById('failed-count').textContent = failedCount;
        
        // Tamamlanma mesajını güncelle
        const completionMessage = document.getElementById('completion-message');
        if (failedCount === 0) {
            completionMessage.textContent = 'Tüm mesajlar başarıyla gönderildi!';
        } else if (successCount === 0) {
            completionMessage.textContent = 'Hiçbir mesaj gönderilemedi!';
        } else {
            completionMessage.textContent = `${successCount} mesaj başarıyla gönderildi, ${failedCount} mesaj gönderilemedi.`;
        }
        
        // Ana sayfayı gizle, tamamlanma sayfasını göster
        document.getElementById('main-container').style.display = 'none';
        document.getElementById('completion-container').style.display = 'block';
        
        // Kontrol butonlarını gizle
        controlButtons.style.display = 'none';
    }
    
    function resetUI() {
        // İşlem durumunu güncelle
        isProcessing = false;
        isPaused = false;
        
        // Durum göstergesini gizle
        document.getElementById('status').style.display = 'none';
        
        // Kontrol butonlarını gizle
        controlButtons.style.display = 'none';
        
        // Durdur/Devam Et butonlarını sıfırla
        pauseButton.style.display = 'inline-block';
        resumeButton.style.display = 'none';
    }
    
    // Formların varsayılan davranışını engelle
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
        });
    });
    
    // Durum kontrolü için periyodik istek
    let statusCheckInterval = null;
    
    function startStatusCheck() {
        // Önceki interval'ı temizle
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
        }
        
        // Her 2 saniyede bir durum kontrolü yap
        statusCheckInterval = setInterval(checkStatus, 2000);
    }
    
    function checkStatus() {
        fetch(`${API_BASE_URL}/status`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    updateProgress(data.progress, data.total, data.success_count, data.failed_count);
                    
                    // İşlem tamamlandıysa interval'ı durdur
                    if (data.progress === data.total && data.total > 0) {
                        clearInterval(statusCheckInterval);
                    }
                }
            })
            .catch(error => {
                console.error('Durum kontrolü hatası:', error);
            });
    }
    
    // Seçilen kişilerin önizlemesini güncelle
    function updateSelectedContactsPreview() {
        const previewElement = document.getElementById('recipients-preview');
        
        if (selectedContacts.length === 0) {
            clearPreview();
            return;
        }
        
        previewElement.innerHTML = '';
        
        // En fazla 5 kişi göster
        const maxPreviewContacts = Math.min(5, selectedContacts.length);
        
        for (let i = 0; i < maxPreviewContacts; i++) {
            const contact = selectedContacts[i];
            const recipientItem = document.createElement('div');
            recipientItem.className = 'recipient-item';
            recipientItem.innerHTML = `
                <strong>${contact.name}</strong>
                <p>${contact.number}</p>
            `;
            previewElement.appendChild(recipientItem);
        }
        
        // Daha fazla kişi varsa belirt
        if (selectedContacts.length > 5) {
            const moreInfo = document.createElement('p');
            moreInfo.textContent = `... ve ${selectedContacts.length - 5} kişi daha`;
            moreInfo.style.textAlign = 'center';
            moreInfo.style.marginTop = '10px';
            moreInfo.style.fontStyle = 'italic';
            previewElement.appendChild(moreInfo);
        }
    }
    
    // Seçilen kişilere mesaj gönderme işlemini başlat
    function processSelectedContactsAndSend(contacts, message, repeat, waitTime, closeTime) {
        // İşlem durumunu güncelle
        isProcessing = true;
        
        // Durum göstergesini göster
        const statusElement = document.getElementById('status');
        const progressBar = document.querySelector('.progress-bar');
        const statusText = document.querySelector('.status-text');
        
        statusElement.style.display = 'block';
        progressBar.style.width = '0%';
        statusText.textContent = 'Kişilere mesaj göndermeye hazırlanıyor...';
        
        // Kontrol butonlarını göster
        controlButtons.style.display = 'flex';
        
        // Kişileri ve mesajı hazırla
        const formData = new FormData();
        
        // Kişileri JSON olarak ekle
        formData.append('contacts', JSON.stringify(contacts));
        formData.append('message', message);
        formData.append('repeat', repeat);
        formData.append('wait_time', waitTime);
        formData.append('close_time', closeTime);
        
        // Python betiğini çağır
        fetch(`${API_BASE_URL}/send-to-contacts`, {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Durum kontrolünü başlat
                    startStatusCheck();
                } else {
                    progressBar.style.width = '100%';
                    statusText.textContent = 'Hata: ' + data.error;
                    resetUI();
                }
            })
            .catch(error => {
                console.error('Hata:', error);
                progressBar.style.width = '100%';
                statusText.textContent = 'Bir hata oluştu: ' + error.message;
                resetUI();
            });
    }
}); 