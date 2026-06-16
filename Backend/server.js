const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { PDFDocument, StandardFonts } = require('pdf-lib'); 
const mammoth = require('mammoth'); 
const XLSX = require('xlsx');
const JSZip = require('jszip');
const PDFParser = require('pdf2json');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const PptxGenJS = require('pptxgenjs');
const fs = require('fs');
const path = require('path');
const { salvarConversao } = require('./database');

const app = express();
app.use(cors());

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

const upload = multer({ dest: 'uploads/' });
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// ==========================================
// FUNÇÃO AUXILIAR PARA LER PDF
// ==========================================
function extrairTextoDoPDF(caminhoArquivo) {
    return new Promise((resolve, reject) => {
        let pdfParser = new PDFParser(this, 1);
        pdfParser.on("pdfParser_dataError", (errData) => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", (pdfData) => {
            let textoCompleto = "";
            pdfData.Pages.forEach(page => {
                page.Texts.forEach(text => {
                    const textoLinha = text.R.map(run => decodeURIComponent(run.T)).join(' ');
                    textoCompleto += textoLinha + " ";
                });
                textoCompleto += "\n";
            });
            resolve(textoCompleto);
        });
        pdfParser.loadPDF(caminhoArquivo);
    });
}

// ==========================================
// CONVERSÕES PARA PDF
// ==========================================

app.post('/convert/image-to-pdf', upload.single('file'), async (req, res) => {
    try {
        console.log('📸 Iniciando conversão Image-to-PDF');
        
        const pdfDoc = await PDFDocument.create();
        const imageBytes = fs.readFileSync(req.file.path);
        let image;
        
        if (req.file.mimetype.includes('jpeg') || req.file.mimetype.includes('jpg')) {
            image = await pdfDoc.embedJpg(imageBytes);
        } else if (req.file.mimetype.includes('png')) {
            image = await pdfDoc.embedPng(imageBytes);
        } else { 
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Apenas JPG e PNG.' }); 
        }
        
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        const pdfBytes = await pdfDoc.save();
        
        // === SALVAR NO BANCO DE DADOS ===
        await salvarConversao({
            original_filename: req.file.originalname,
            original_format: 'image',
            converted_format: 'pdf',
            file_size_bytes: req.file.size,
            status: 'completed'
        });
        
        fs.unlinkSync(req.file.path);
        res.set({ 
            'Content-Type': 'application/pdf', 
            'Content-Disposition': 'attachment; filename="convertido.pdf"' 
        });
        res.send(Buffer.from(pdfBytes));
    } catch (error) { 
        console.error('❌ Erro na conversão:', error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message }); 
    }
});

app.post('/convert/txt-to-pdf', upload.single('file'), async (req, res) => {
    try {
        const text = fs.readFileSync(req.file.path, 'utf-8');
        await gerarPdfDeTexto(text, res, req.file.path);
        
        await salvarConversao({
            original_filename: req.file.originalname,
            original_format: 'txt',
            converted_format: 'pdf',
            file_size_bytes: req.file.size,
            status: 'completed'
        });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/convert/word-to-pdf', upload.single('file'), async (req, res) => {
    try {
        const result = await mammoth.extractRawText({ path: req.file.path });
        await gerarPdfDeTexto(result.value, res, req.file.path);
        
        await salvarConversao({
            original_filename: req.file.originalname,
            original_format: 'word',
            converted_format: 'pdf',
            file_size_bytes: req.file.size,
            status: 'completed'
        });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/convert/excel-to-pdf', upload.single('file'), async (req, res) => {
    try {
        const workbook = XLSX.readFile(req.file.path);
        let textoExtraido = '';
        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            textoExtraido += `--- ABA: ${sheetName} ---\n${csv}\n\n`;
        });
        await gerarPdfDeTexto(textoExtraido, res, req.file.path);
        
        await salvarConversao({
            original_filename: req.file.originalname,
            original_format: 'excel',
            converted_format: 'pdf',
            file_size_bytes: req.file.size,
            status: 'completed'
        });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/convert/html-to-pdf', upload.single('file'), async (req, res) => {
    try {
        const html = fs.readFileSync(req.file.path, 'utf-8');
        const textoPuro = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
        await gerarPdfDeTexto(textoPuro, res, req.file.path);
        
        await salvarConversao({
            original_filename: req.file.originalname,
            original_format: 'html',
            converted_format: 'pdf',
            file_size_bytes: req.file.size,
            status: 'completed'
        });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/convert/ppt-to-pdf', upload.single('file'), async (req, res) => {
    try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const zip = await JSZip.loadAsync(fileBuffer);
        let textoCompleto = '';
        let numeroSlide = 1;
        const arquivos = Object.keys(zip.files);
        const slides = arquivos.filter(arquivo => arquivo.match(/^ppt\/slides\/slide\d+\.xml$/)).sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)/)[1]);
            const numB = parseInt(b.match(/slide(\d+)/)[1]);
            return numA - numB;
        });
        
        for (const slidePath of slides) {
            const conteudoXML = await zip.files[slidePath].async('string');
            const textos = conteudoXML.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
            const textoSlide = textos.map(t => t.replace(/<[^>]*>/g, '')).join(' ');
            textoCompleto += `=== SLIDE ${numeroSlide} ===\n${textoSlide}\n\n`;
            numeroSlide++;
        }
        await gerarPdfDeTexto(textoCompleto, res, req.file.path);
        
        await salvarConversao({
            original_filename: req.file.originalname,
            original_format: 'ppt',
            converted_format: 'pdf',
            file_size_bytes: req.file.size,
            status: 'completed'
        });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ==========================================
// CONVERSÕES DE PDF PARA OUTROS
// ==========================================

app.post('/convert/pdf-to-txt', upload.single('file'), async (req, res) => {
    try {
        console.log('📄 Convertendo PDF para TXT');
        const texto = await extrairTextoDoPDF(req.file.path);
        
        await salvarConversao({
            original_filename: req.file.originalname,
            original_format: 'pdf',
            converted_format: 'txt',
            file_size_bytes: req.file.size,
            status: 'completed'
        });
        
        fs.unlinkSync(req.file.path);
        res.set({ 'Content-Type': 'text/plain', 'Content-Disposition': 'attachment; filename="convertido.txt"' });
        res.send(texto);
    } catch (error) { 
        console.error('Erro PDF->TXT:', error);
        res.status(500).json({ error: error.message }); 
    }
});

app.post('/convert/pdf-to-word', upload.single('file'), async (req, res) => {
    try {
        console.log('📝 Convertendo PDF para Word');
        const texto = await extrairTextoDoPDF(req.file.path);
        
        const doc = new Document({
            sections: [{
                children: texto.split('\n').map(line => 
                    new Paragraph({ children: [new TextRun(line)] })
                )
            }]
        });
        
        const buffer = await Packer.toBuffer(doc);
        
        await salvarConversao({
            original_filename: req.file.originalname,
            original_format: 'pdf',
            converted_format: 'word',
            file_size_bytes: req.file.size,
            status: 'completed'
        });
        
        fs.unlinkSync(req.file.path);
        
        res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': 'attachment; filename="convertido.docx"' });
        res.send(buffer);
    } catch (error) { 
        console.error('Erro PDF->Word:', error);
        res.status(500).json({ error: error.message }); 
    }
});

app.post('/convert/pdf-to-ppt', upload.single('file'), async (req, res) => {
    try {
        console.log('📊 Convertendo PDF para PowerPoint');
        const texto = await extrairTextoDoPDF(req.file.path);
        
        const pptx = new PptxGenJS();
        pptx.layout = 'LAYOUT_WIDE';
        
        const blocos = texto.match(/[\s\S]{1,500}(?:\s|$)/g) || [texto];
        
        blocos.forEach((textoBloco) => {
            const slide = pptx.addSlide();
            slide.addText(textoBloco.trim(), { x: 0.5, y: 0.5, w: '90%', h: '80%', fontSize: 18, valign: 'top' });
        });
        
        const buffer = await pptx.write({ outputType: 'nodebuffer' });
        
        await salvarConversao({
            original_filename: req.file.originalname,
            original_format: 'pdf',
            converted_format: 'ppt',
            file_size_bytes: req.file.size,
            status: 'completed'
        });
        
        fs.unlinkSync(req.file.path);
        
        res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'Content-Disposition': 'attachment; filename="convertido.pptx"' });
        res.send(buffer);
    } catch (error) { 
        console.error('Erro PDF->PPT:', error);
        res.status(500).json({ error: error.message }); 
    }
});

// MOTOR GERAL DE TEXTO PARA PDF
async function gerarPdfDeTexto(text, res, caminhoArquivo) {
    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let page = pdfDoc.addPage([595.28, 841.89]);
    let y = 800;
    const lines = text.split('\n');
    for (const line of lines) {
        if (y < 50) { page = pdfDoc.addPage([595.28, 841.89]); y = 800; }
        const linhaLimpa = line.replace(/[^\x00-\xFF]/g, ''); 
        page.drawText(linhaLimpa.substring(0, 80), { x: 50, y, size: 12, font: helveticaFont });
        y -= 15;
    }
    const pdfBytes = await pdfDoc.save();
    fs.unlinkSync(caminhoArquivo);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="convertido.pdf"' });
    res.send(Buffer.from(pdfBytes));
}

const PORT = 3000;
app.listen(PORT, () => console.log('✅ Servidor rodando em http://localhost:3000'));
