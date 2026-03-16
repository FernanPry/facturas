const fs = require('fs');
const path = require('path');

const pdfService = require('./pdf');

/**
 * Utilidad para el manejo de almacenamiento persistente de facturas
 */
const storage = {
    /**
     * Guarda un buffer de datos en la carpeta del usuario
     * @param {number|string} userId - ID del usuario
     * @param {Buffer} buffer - Contenido del archivo
     * @param {string} originalName - Nombre original o sugerido con extensión
     * @returns {string} - Ruta relativa guardada (uploads/{userId}/{filename})
     */
    saveFile: (userId, buffer, originalName) => {
        const userDir = path.join(__dirname, '../uploads', userId.toString());
        
        // Asegurar que el directorio existe
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        const ext = path.extname(originalName) || '.pdf';
        const baseName = path.basename(originalName, ext);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `${baseName}-${uniqueSuffix}${ext}`;
        const fullPath = path.join(userDir, filename);
        const relativePath = `uploads/${userId}/${filename}`;

        fs.writeFileSync(fullPath, buffer);
        console.log(`[STORAGE] Archivo guardado: ${relativePath}`);
        
        return relativePath;
    },

    /**
     * Procesa y guarda uno o varios archivos de factura, convirtiéndolos a PDF si es necesario.
     * @param {number|string} userId - ID del usuario
     * @param {Array<{buffer: Buffer, originalName: string, mimeType: string}>} files - Archivos a procesar
     * @returns {Promise<string>} - Ruta relativa del PDF final
     */
    saveInvoiceFiles: async (userId, files) => {
        if (!files || files.length === 0) {
            throw new Error("No se han proporcionado archivos");
        }

        // Si es un solo PDF, lo guardamos directamente
        if (files.length === 1 && files[0].mimeType === 'application/pdf') {
            return storage.saveFile(userId, files[0].buffer, files[0].originalName);
        }

        // Si son imágenes (o varios PDFs/mezcla), los convertimos/unimos en un solo PDF
        // Por ahora, el requerimiento es agrupar fotos en un PDF.
        const imageBuffers = files
            .filter(f => f.mimeType.startsWith('image/'))
            .map(f => f.buffer);

        if (imageBuffers.length === 0 && files.length > 0) {
            // Si no hay imágenes pero hay archivos (ej. un PDF solo), usar el primero
            return storage.saveFile(userId, files[0].buffer, files[0].originalName);
        }

        const pdfBuffer = await pdfService.createPdfFromImages(imageBuffers);
        const suggestedName = imagesToPdfName(files[0].originalName);
        
        return storage.saveFile(userId, pdfBuffer, suggestedName);
    },

    /**
     * Elimina un archivo físico del disco
     * @param {string} relativePath - Ruta relativa guardada
     */
    deleteFile: (relativePath) => {
        if (!relativePath) return;
        const fullPath = path.join(__dirname, '..', relativePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`[STORAGE] Archivo eliminado: ${relativePath}`);
        } else {
            console.warn(`[STORAGE] Intento de eliminar archivo inexistente: ${fullPath}`);
        }
    }
};

/**
 * Genera un nombre de archivo PDF basado en el nombre original de la imagen
 */
function imagesToPdfName(originalName) {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    return `${baseName}.pdf`;
}

module.exports = storage;
