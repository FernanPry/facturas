# Cajón AI - Módulo Facturas: Manual de Instalación

Este manual proporciona los pasos necesarios para instalar y desplegar **Cajón AI - Facturas** en un entorno de producción (especialmente en una **Raspberry Pi**, según la arquitectura actual del proyecto).

---

## 1. Requisitos Previos

Antes de proceder, asegúrate de que el servidor (Raspberry Pi, VPS, etc.) tenga instalado:
- **Node.js**: Entorno de ejecución de JavaScript. (Versión recomendada: v18+).
- **NPM**: Gestor de paquetes de Node.js.
- **Git**: Sistema de control de versiones.
- **Nginx**: Servidor web para el Frontend.
- **Base de Datos** (e.g., SQLite, PostgreSQL o MySQL): Dependiendo de la configuración descrita en `schema.sql` y `config`.
- **Ngrok** (Opcional): Para acceso externo durante el desarrollo si no se dispone de una IP pública o dominio.

---

## 2. Descarga del Código Fuente

Sitúate en el directorio de trabajo donde deseas alojar el proyecto y clona el repositorio desde GitHub:

```bash
cd /ruta/hacia/proyectos
git clone https://github.com/usuario/facturas.git
cd facturas
```

---

## 3. Uso del Script de Despliegue Automatizado (`deploy.sh`)

El proyecto incluye un script de automatización que facilita el despliegue. Este script:
1. Actualiza los cambios desde `origin main`.
2. Instala PM2 globalmente (si no está ya instalado) para administrar el proceso del Backend.
3. Instala dependencias e inicia el Backend.
4. Construye ('builds') la versión de producción del Frontend.

**Ejecución:**
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 4. Instalación Manual (Paso a Paso)

Si prefieres realizar la instalación manualmente en lugar de usar `deploy.sh`, sigue estos pasos:

### 4.1. Configuración del Backend

1. **Navega a la carpeta de backend**:
   ```bash
   cd backend
   ```
2. **Instala las dependencias**:
   ```bash
   npm install
   ```
3. **Variables de Entorno**:
   Copia el archivo de prueba `.env.example` y renómbralo a `.env`:
   ```bash
   cp .env.example .env
   ```
   Edita el `.env` para añadir tu API Key de **Gemini AI**, y credenciales de base de datos/JWT.
   
4. **Instalación de PM2**:
   ```bash
   npm install -g pm2
   ```
5. **Inicia el Servidor Backend**:
   ```bash
   pm2 start server.js --name facturas-backend
   pm2 save # Para que autoarranque tras un reinicio del sistema
   ```

### 4.2. Configuración del Frontend

1. **Navega a la carpeta de frontend**:
   ```bash
   cd ../frontend
   ```
2. **Instala las dependencias**:
   ```bash
   npm install
   ```
3. **Genera los archivos estáticos para Producción**:
   ```bash
   npm run build
   ```
   Esto generará una carpeta `dist` con los archivos compilados listos para servir.

---

## 5. Configurar el Servidor Web (Nginx)

El servidor Frontend debe ser servido usando Nginx u otro servidor estático.

1. Abre el archivo de configuración de Nginx:
   ```bash
   sudo nano /etc/nginx/sites-available/facturas
   ```
2. Añade este bloque de configuración apuntando a la carpeta de `build/dist` que generaste en el paso 4.2:
   ```nginx
   server {
       listen 80;
       server_name tu-dominio.com o-IP-del-servidor;

       root /ruta/absoluta/a/facturas/frontend/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # Proxy inverso para reenviar las peticiones de la API al Backend (ej: puerto 3000 o 5000)
       location /api/ {
           proxy_pass http://localhost:5000; # Cambiar puerto según config en .env
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```
3. **Activar configuración y reiniciar Nginx**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/facturas /etc/nginx/sites-enabled/
   sudo systemctl restart nginx
   ```

---

## 6. Integración Externa y Webhooks (Opcional - Telegram/El Orquestador)

Para integraciones tipo "Troni" o "El Orquestador":
- Si el proyecto corre en una máquina local o Raspberry Pi oculta, deberás asegurar una conexión HTTP directa (o un proxy/ngrok) usando la IP/Puerto si tu bot/orquestador también corre de manera privada o necesita conectividad webhook.

¡Felicidades! **Cajón AI - Facturas** ahora está instalado y corriendo.
