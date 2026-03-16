const PDFDocument = require('pdfkit');
const sizeOf = require('buffer-image-size');

/**
 * Servicio para generar PDFs a partir de imágenes
 */
const pdfService = {
    /**
     * Crea un PDF a partir de uno o varios buffers de imagen
     * @param {Buffer[]} imageBuffers - Array de buffers de imagen
     * @returns {Promise<Buffer>} - Buffer del PDF generado
     */
    createPdfFromImages: async (imageBuffers) => {
        return new Promise((resolve, reject) => {
            try {
                if (!imageBuffers || imageBuffers.length === 0) {
                    return reject(new Error("No hay imágenes para convertir"));
                }

                const doc = new PDFDocument({
                    autoFirstPage: false,
                    margin: 0
                });

                const chunks = [];
                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                for (const buffer of imageBuffers) {
                    try {
                        const dim = sizeOf(buffer);
                        doc.addPage({ size: [dim.width, dim.height] });
                        doc.image(buffer, 0, 0, { width: dim.width, height: dim.height });
                    } catch (e) {
                        console.error("[PDF] Error al procesar una imagen:", e);
                        // Omitir imagen corrupta o continuar
                    }
                }

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }
};

module.exports = pdfService;
