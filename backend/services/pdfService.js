const pdf = require('pdfkit');
const fs = require('fs');

class PDFService {
    createPDF(reportData, filePath) {
        const doc = new pdf();
        doc.pipe(fs.createWriteStream(filePath));

        doc.fontSize(25).text('Coconut Leaf Detection Report', { align: 'center' });
        doc.moveDown();

        // Add report data
        for (const [key, value] of Object.entries(reportData)) {
            doc.fontSize(12).text(`${key}: ${value}`);
            doc.moveDown();
        }

        doc.end();
    }
}

module.exports = new PDFService();