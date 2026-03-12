const fs = require('fs');
const path = require('path');

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

module.exports = storage;
