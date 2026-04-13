const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const dns = require("dns");

// Polyfill fetch para Node 18 y forzar IPv4 para evitar errores de red en Raspberry Pi
// Forzamos node-fetch porque el fetch nativo de Node 18 a veces falla en este entorno
global.fetch = require("node-fetch");

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

/**
 * Servicio para interactuar con Gemini 1.5 Flash para extracción OCR
 */
class GeminiService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY no se encontró en las variables de entorno");
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      generationConfig: { responseMimeType: "application/json" }
    });
  }

  /**
   * Extrae datos de archivos de facturas (PDF o Imágenes)
   * @param {Array<{data: string, mimeType: string}>} files - Array de datos base64 y tipos MIME
   * @param {boolean} includeReq - Si se debe buscar el Recargo de Equivalencia
   */
  async extractInvoiceData(files, includeReq = false) {
    const prompt = `
    Analiza la factura adjunta (puede constar de varias imágenes o un PDF).
    Extrae la siguiente información prestando especial atención a la sección de impuestos:

    - Fecha (Date)
    - Emisor Factura (Nombre de la empresa o emisor)
    - Número Factura (Referencia)
    - Subtotal (Base imponible/Sin IVA)
    - Total IVA (Importe del IVA)
    - Recargo Equivalencia (Busca específicamente 'Recargo de Equivalencia', 'R.EQ.' o '% R.EQ.'. Extrae el IMPORTE TOTAL, no el porcentaje)
    - TOTAL (Importe total incluyendo IVA y Recargo)

    IMPORTANTE: En algunas facturas como las de "Logista", el Recargo de Equivalencia (R.EQ.) y el IVA están en columnas. Busca la suma debajo de estas columnas.
    REGLA MURSHE: En las facturas de "Distribuciones Murshe S.L", el Nº Factura está justo debajo del nombre y tiene el formato "XX / XXXXXXXX" (ejemplo: 26 / 26011494). Extráelo completo.
    
    
    Devuelve los datos estrictamente en formato JSON con estas claves exactas:
    {
      "emisor": "Nombre del emisor",
      "fecha_emision": "YYYY-MM-DD",
      "referencia": "Número de factura",
      "subtotal": 0.0,
      "iva": 0.0,
      "r_eq": 0.0,
      "total_impuestos": 0.0,
      "total": 0.0
    }

    NOTAS:
    - total_impuestos debe ser la suma de iva + r_eq.
    - Si un valor no se encuentra, usa 0.0 para campos numéricos y "" para cadenas.
    - Asegúrate de que los campos numéricos sean floats con punto como separador decimal.
    `;

    const parts = [
      { text: prompt },
      ...files.map(file => ({
        inlineData: {
          data: file.data,
          mimeType: file.mimeType
        }
      }))
    ];

    try {
      const result = await this.model.generateContent(parts);
      const response = await result.response;
      const text = response.text();
      // Limpiar posibles bloques de código markdown si Gemini los incluye
      const cleanedText = text.replace(/```json|```/g, "").trim();
      return JSON.parse(cleanedText);
    } catch (error) {
      console.error("Error en la extracción de Gemini:", error);
      throw new Error("Error al extraer datos de la factura: " + error.message);
    }
  }
}

module.exports = new GeminiService();
