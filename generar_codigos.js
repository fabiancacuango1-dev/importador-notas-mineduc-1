// Generador de códigos únicos en PDF para licencias
// Uso: node generar_codigos.js cantidad

const fs = require('fs');
const { jsPDF } = require('jspdf');
const crypto = require('crypto');

function generarCodigoUnico() {
  // Código de 12 caracteres alfanuméricos, solo mayúsculas y números
  return crypto.randomBytes(9).toString('base64').replace(/[^A-Z0-9]/gi, '').substring(0, 12).toUpperCase();
}

function generarPDF(codigos, archivo) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Códigos de Licencia Únicos', 20, 20);
  doc.setFontSize(12);
  let y = 40;
  codigos.forEach((codigo, i) => {
    doc.text(`${i + 1}. ${codigo}`, 20, y);
    y += 10;
    if (y > 270 && i < codigos.length - 1) {
      doc.addPage();
      y = 20;
    }
  });
  // Guardar el PDF en disco
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(archivo, pdfBuffer);
}

// Uso desde terminal: node generar_codigos.js 200
const cantidad = parseInt(process.argv[2] || '200', 10);
const codigos = Array.from({ length: cantidad }, generarCodigoUnico);
const archivo = `codigos_licencia_${Date.now()}.pdf`;

generarPDF(codigos, archivo);

// También guarda los códigos en un archivo de texto para control
fs.writeFileSync(archivo.replace('.pdf', '.txt'), codigos.join('\n'));

console.log(`Generados ${cantidad} códigos únicos en ${archivo}`);