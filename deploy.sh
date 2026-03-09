#!/bin/bash

# Script de despliegue profesional para Raspberry Pi
# Detiene el proceso actual, descarga cambios, construye y reinicia con PM2.

echo "🚀 Iniciando despliegue en Raspberry Pi..."

# 1. Actualizar código desde Git
echo "📥 Descargando últimos cambios..."
git pull origin main

# 1.5 Verificar herramientas necesarias
if ! command -v pm2 &> /dev/null; then
    echo "⚠️ PM2 no encontrado. Intentando instalar..."
    npm install -g pm2
fi

# 2. Preparar Backend
echo "📦 Instalando dependencias del Backend..."
cd backend
npm install
echo "🔄 Reiniciando Backend con PM2..."
pm2 restart facturas-backend || pm2 start server.js --name facturas-backend
cd ..

# 3. Preparar Frontend
echo "🏗️ Construyendo el Frontend..."
cd frontend
npm install
npm run build
cd ..

echo "✅ Despliegue completado con éxito."
echo "💡 Recuerda que Nginx debe apuntar a: $(pwd)/frontend/dist"
