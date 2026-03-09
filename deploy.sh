#!/bin/bash

# Script de despliegue profesional para Raspberry Pi
# Detiene el proceso actual, descarga cambios, construye y reinicia con PM2.

echo "🚀 Iniciando despliegue en Raspberry Pi..."

# 1. Actualizar código desde Git
echo "📥 Descargando últimos cambios..."
git pull origin main

# 2. Preparar Backend
echo "📦 Instalando dependencias del Backend..."
cd backend
npm install
echo "🔄 Reiniciando Backend con PM2..."
pm2 restart backend || pm2 start server.js --name backend
cd ..

# 3. Preparar Frontend
echo "🏗️ Construyendo el Frontend..."
cd frontend
npm install
npm run build
cd ..

echo "✅ Despliegue completado con éxito."
echo "💡 Recuerda que Nginx debe apuntar a: $(pwd)/frontend/dist"
