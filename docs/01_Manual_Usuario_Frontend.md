# Cajón AI - Módulo Facturas: Manual Detallado de Usuario del Frontend

Bienvenido a **Cajón AI - Facturas**, tu sistema de archivación de facturas en un cajón inteligente impulsado por Inteligencia Artificial. Este manual te guiará paso a paso por todas las funcionalidades de la interfaz de usuario.

---

## 1. Acceso al Sistema (Login)
1. Ingresa a la URL proporcionada de la plataforma.
2. Serás recibido por la **Landing Page** (página de inicio), donde podrás ver las características del servicio: procesamiento con IA, organización de datos y más.
3. Haz clic en el botón de **"Iniciar Sesión"** o **"Acceder"**.
4. Serás redirigido a la página de **Autenticación (`/auth`)**. Ingresa tu correo electrónico y tu contraseña para entrar.

---

## 2. Panel Principal (Dashboard)
Una vez dentro, entrarás al área de trabajo principal. A la izquierda tendrás el **Menú de Navegación (Sidebar)** y a la derecha el contenido.

### Vista de Facturas
- **Objetivo**: "Gestiona y visualiza tus facturas procesadas por IA".
- **Funcionalidad**: En esta sección verás un listado de todas las facturas que han sido subidas al sistema y analizadas por el modelo Gemini AI.
- **Acciones Permitidas**:
  - **Filtros rápidos**: Puedes buscar y filtrar facturas por fecha, proveedor o estado (pendientes, pagadas).
  - **Detalles**: Haciendo clic en una factura, podrás ver rápidamente los campos extraídos automáticamente (CIF, importe total, base imponible, impuestos, fecha, proveedor).
  - **Descargas/Exportación**: Permite descargar los datos estructurados o el archivo original.

---

## 3. Subir Facturas (Carga Manual)
- **Ruta**: Menú Lateral -> "Subir Facturas" (`/dashboard/upload`).
- **Objetivo**: "Carga manualmente una factura desde tu PC para procesarla por IA".
- **Funcionalidades**:
  1. **Arrastrar y soltar (Drag & Drop)**: Puedes arrastrar tu archivo PDF de la factura directamente en el área punteada de la pantalla.
  2. **Explorador de Archivos**: Al hacer clic, se abre una ventana para buscar y seleccionar el archivo en tu ordenador.
  3. **Procesamiento AI**: En cuanto el archivo sube, Cajón AI se comunica con Gemini AI para leer automáticamente todo el contenido. Una barra de progreso o indicador de carga te avisará cuando haya terminado, y la factura aparecerá en tu *Dashboard* con los datos rellenados por arte de magia.

---

## 4. Configuración de Perfil
- **Ruta**: Menú Lateral -> "Perfil" (`/dashboard/profile`).
- **Objetivo**: "Personaliza tus datos de facturación y canales de ingesta".
- **Funcionalidades**:
  - **Datos de Empresa/Personales**: Lugar donde actualizas tu nombre, CIF/NIF, dirección y razón social. Estos datos ayudan a la IA a distinguir entre "Facturas Emitidas" y "Recibidas".
  - **Canales de Ingesta**: Información sobre cómo conectar fuentes automáticas para recibir facturas (por ejemplo, mediante bots, correo electrónico o Telegram).

---

## 5. Ajustes de Cuenta (Settings)
- **Ruta**: Menú Lateral -> "Ajustes de Cuenta" (`/dashboard/settings`).
- **Objetivo**: "Gestiona tus credenciales de acceso y seguridad".
- **Funcionalidades**:
  - **Cambiar Contraseña**: Opciones para actualizar tu contraseña por motivos de seguridad.
  - **Notificaciones**: Preferencias de alertas para saber cuándo una factura se procesó correctamente o si hubo un error de lectura.
  - **Cerrar Sesión (Logout)**: Botón para salir del sistema de forma segura.

---

## 6. Diseño Responsivo
- La aplicación ("Cajón AI") está diseñada para funcionar a la perfección en resoluciones de navegador de PC como en tabletas y dispositivos móviles.
- En resoluciones pequeñas, el **Sidebar lateral desaparece** y se convierte en un menú tipo "hamburguesa" accesible desde la zona superior para facilitar la lectura.

---
**¿Dudas adicionales?**  
Para consultas técnicas o problemas en el reconocimiento de Inteligencia artificial, puedes contactar con tu administrador de sistema.
