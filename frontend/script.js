document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.converter-card');
    const modal = document.getElementById('converterModal');
    const closeBtn = document.getElementById('closeBtn');
    const fileInput = document.getElementById('fileInput');
    const uploadBox = document.getElementById('uploadBox');
    const selectBtn = document.getElementById('selectBtn');
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const statusText = document.getElementById('statusText');
    const successSection = document.getElementById('successSection');
    const downloadBtn = document.getElementById('downloadBtn');
    const newConversionBtn = document.getElementById('newConversionBtn');
    const modalTitle = document.getElementById('modalTitle');
    const modalIcon = document.getElementById('modalIcon');
    const fileName = document.getElementById('fileName');
    const fileTypes = document.getElementById('fileTypes');

    const converterConfig = {
        'image-to-pdf': {
            title: 'Converter Imagem para PDF',
            icon: 'fa-image',
            accept: '.jpg,.jpeg,.png',
            types: 'JPG, PNG',
            rota: 'image-to-pdf',
            extSaida: 'pdf'
        },
        'word-to-pdf': {
            title: 'Converter Word para PDF',
            icon: 'fa-file-word',
            accept: '.docx',
            types: 'DOCX',
            rota: 'word-to-pdf',
            extSaida: 'pdf'
        },
        'excel-to-pdf': {
            title: 'Converter Excel para PDF',
            icon: 'fa-file-excel',
            accept: '.xlsx,.xls',
            types: 'XLSX, XLS',
            rota: 'excel-to-pdf',
            extSaida: 'pdf'
        },
        'ppt-to-pdf': {
            title: 'Converter PowerPoint para PDF',
            icon: 'fa-file-powerpoint',
            accept: '.pptx,.ppt',
            types: 'PPTX, PPT',
            rota: 'ppt-to-pdf',
            extSaida: 'pdf'
        },
        'txt-to-pdf': {
            title: 'Converter Texto para PDF',
            icon: 'fa-file-lines',
            accept: '.txt',
            types: 'TXT',
            rota: 'txt-to-pdf',
            extSaida: 'pdf'
        },
        'html-to-pdf': {
            title: 'Converter HTML para PDF',
            icon: 'fa-file-code',
            accept: '.html,.htm',
            types: 'HTML, HTM',
            rota: 'html-to-pdf',
            extSaida: 'pdf'
        },
        'pdf-to-word': {
            title: 'Converter PDF para Word',
            icon: 'fa-file-word',
            accept: '.pdf',
            types: 'PDF',
            rota: 'pdf-to-word',
            extSaida: 'docx'
        },
        'pdf-to-ppt': {
            title: 'Converter PDF para PowerPoint',
            icon: 'fa-file-powerpoint',
            accept: '.pdf',
            types: 'PDF',
            rota: 'pdf-to-ppt',
            extSaida: 'pptx'
        },
        'pdf-to-txt': {
            title: 'Converter PDF para Texto',
            icon: 'fa-file-lines',
            accept: '.pdf',
            types: 'PDF',
            rota: 'pdf-to-txt',
            extSaida: 'txt'
        }
    };

    let currentConfig = null;
    let currentFile = null;
    let progressInterval = null;

    cards.forEach(card => {
        card.addEventListener('click', () => {
            const type = card.dataset.type;
            currentConfig = converterConfig[type];
            
            modalTitle.textContent = currentConfig.title;
            modalIcon.innerHTML = '<i class="fa-solid ' + currentConfig.icon + '"></i>';
            fileTypes.textContent = currentConfig.types;
            fileInput.accept = currentConfig.accept;
            
            uploadBox.style.display = 'block';
            progressSection.style.display = 'none';
            successSection.style.display = 'none';
            progressBar.style.width = '0%';
            progressText.textContent = '0%';
            
            modal.classList.add('active');
        });
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        clearInterval(progressInterval);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            clearInterval(progressInterval);
        }
    });

    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragover');
    });

    uploadBox.addEventListener('dragleave', () => {
        uploadBox.classList.remove('dragover');
    });

    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    selectBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        currentFile = file;
        fileName.textContent = file.name;
        
        uploadBox.style.display = 'none';
        progressSection.style.display = 'block';
        
        simulateProgress(() => {
            uploadFile(file);
        });
    }

    function simulateProgress(callback) {
        let progress = 0;
        const stages = [
            { at: 10, text: 'Lendo arquivo...' },
            { at: 30, text: 'Processando...' },
            { at: 60, text: 'Convertendo...' },
            { at: 85, text: 'Finalizando...' },
            { at: 100, text: 'Concluído!' }
        ];

        progressInterval = setInterval(() => {
            progress += Math.random() * 8 + 2;
            if (progress > 95) progress = 95;
            
            progressBar.style.width = progress + '%';
            progressText.textContent = Math.floor(progress) + '%';

            const stage = stages.find(s => progress >= s.at);
            if (stage) statusText.textContent = stage.text;

            if (progress >= 95) {
                clearInterval(progressInterval);
                callback();
            }
        }, 200);
    }

    async function uploadFile(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const url = 'https://pdf-meu-amor.onrender.com/convert/' + currentConfig.rota;
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Erro no servidor');
            }

            const blob = await response.blob();
            const urlDownload = window.URL.createObjectURL(blob);
            
            downloadBtn.onclick = () => {
                const a = document.createElement('a');
                a.href = urlDownload;
                a.download = file.name.replace(/\.[^/.]+$/, '') + '.' + currentConfig.extSaida;
                document.body.appendChild(a);
                a.click();
                a.remove();
            };

            progressSection.style.display = 'none';
            successSection.style.display = 'block';

        } catch (error) {
            console.error(error);
            statusText.textContent = 'Erro: ' + error.message;
            statusText.style.color = '#ef4444';
        }
    }

    newConversionBtn.addEventListener('click', () => {
        uploadBox.style.display = 'block';
        progressSection.style.display = 'none';
        successSection.style.display = 'none';
        fileInput.value = '';
    });
});
