# Cajón AI - Módulo Facturas: Puntos de Mejora y Ampliación

El sistema "Cajón AI" está preparado para escalar. A continuación, se proponen varias líneas estratégicas para mejorar y diversificar el producto tecnológico actual:

---

## 1. Mejoras de Inteligencia Artificial y OCR
- **Integración Multimodelo (Fallback AI):** En caso de que Gemini AI no devuelva datos adecuados por algún cambio de formato en la factura, incorporar un segundo proveedor (como *Claude 3.5 Sonnet*, *GPT-4o* o *Azure Form Recognizer*) para cruzar resultados o funcionar de respaldo logrando un 99.9% de fiabilidad.
- **Detección de Anomalías (Antifraude):** Entrenar o aplicar *prompts* específicos de IA para que detecte IBANs alterados, fechas incompatibles con ejercicios fiscales, y evitar suplantación de identidad o dobles pagos en facturas recibidas.
- **Predicción de Flujo de Caja:** Utilizando el histórico de facturas de un usuario para calcular el pronóstico de gastos (cuándo vencerán los pagos y cuánto será el desembolso previsto cada mes).

## 2. Mejoras de Software (Frontend & Backend)
- **Roles y Permisos Múltiples:** Actualmente, la plataforma es ideal para uso directo, pero un administrador de empresas puede requerir compartir acceso con "Auditores", "Contables" o "Lectores", sin permisos de borrado de facturas.
- **Exportación Contable (Standard ERP/A3/Holded):** Crear un módulo de exportación específico que descargue las facturas en formatos preaprobados por el software contable (CSV adaptado, XML de facturación electrónica o integración vía API nativa con Holded/A3).
- **Conciliación Bancaria Automática:** Permitir, mediante *Open Banking / PSD2*, conectar la cuenta bancaria del usuario y que Cajón AI enlace automáticamente cada cargo bancario con la factura procesada en la base de datos marcándola como "Pagada".

## 3. Ampliación del Producto (Mobile e Integración)
- **Aplicación Nativa PWA/Móvil (iOS & Android):** Permitir tomar fotos de tickets/facturas de restaurantes o gasolina directamente con la cámara del móvil y subirlas al sistema en tiempo real.
- **Integración con WhatsApp Business API:** En lugar de limitarse a Telegram ("El Orquestador / Troni"), abrir la posibilidad de que los proveedores envíen sus facturas como PDF mediante WhatsApp y estas se inyecten directo en el Dashboard mensual.
- **Complemento de Email (Inbound Mailbox):** Asignar a cada empresa o usuario un correo del estilo `facturas.tuempresa@inbox.cajon.ai`. Todos los PDFs de facturas que lleguen allí se auto-procesan y muestran en el dashboard sin intervención humana alguna.

## 4. Mejoras Técnicas / DevOps
- **Migración a Servicios Serverless y Edge:** Para reducir el consumo inicial, migrar ciertas funciones a servicios Edge Computing o Cloud Functions (AWS Lambda o Google Cloud Functions).
- **Copias de Seguridad Automatizadas Diarias en Nube Externa:** Integrar el actual sistema en *Google Drive / AWS S3* para tener redundancia total del "cajón de archivos".
