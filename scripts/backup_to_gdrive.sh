#!/bin/bash

# ==============================================================================
# Script de Backup Automático para Cajón AI (Facturas)
# Respalda la Base de Datos PostgreSQL y los archivos subidos a Google Drive.
# ==============================================================================

# Directorios y Configuración
PROJECT_ROOT="/home/charly/projects/facturas"
BACKUP_TEMP_DIR="$PROJECT_ROOT/backups/temp"
UPLOADS_DIR="$PROJECT_ROOT/backend/uploads"
ENV_FILE="$PROJECT_ROOT/backend/.env"
REMOTE_NAME="remote"
REMOTE_DIR="Facturas_Backups"
RETENTION_DAYS=15

# Crear directorio temporal si no existe
mkdir -p "$BACKUP_TEMP_DIR"

# Cargar DATABASE_URL desde .env
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    echo "Error: No se encontró el archivo .env en $ENV_FILE"
    exit 1
fi

# Generar nombre de archivo con timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_NAME="backup_facturas_$TIMESTAMP"
DB_DUMP_FILE="$BACKUP_TEMP_DIR/db_$TIMESTAMP.sql"
FINAL_ZIP="$BACKUP_TEMP_DIR/$BACKUP_NAME.tar.gz"

echo "--- Iniciando Backup: $TIMESTAMP ---"

# 1. Volcado de la Base de Datos
echo "[1/4] Realizando volcado de la base de datos..."
if pg_dump "$DATABASE_URL" > "$DB_DUMP_FILE"; then
    echo "OK: Base de datos volcada correctamente."
else
    echo "ERROR: Falló el volcado de la base de datos."
    exit 1
fi

# 2. Compresión de DB y Carpetas de Facturas
echo "[2/4] Comprimiendo archivos y base de datos..."
tar -czf "$FINAL_ZIP" -C "$PROJECT_ROOT" "backend/uploads" -C "$BACKUP_TEMP_DIR" "db_$TIMESTAMP.sql"

if [ -f "$FINAL_ZIP" ]; then
    echo "OK: Archivo de backup creado: $(basename "$FINAL_ZIP")"
else
    echo "ERROR: Falló la creación del archivo comprimido."
    exit 1
fi

# 3. Subida a Google Drive
echo "[3/4] Subiendo a Google Drive ($REMOTE_NAME:$REMOTE_DIR)..."
if rclone copy "$FINAL_ZIP" "$REMOTE_NAME:$REMOTE_DIR"; then
    echo "OK: Subida completada."
else
    echo "ERROR: Falló la subida a Google Drive."
    exit 1
fi

# 4. Limpieza
echo "[4/4] Limpiando archivos temporales y backups antiguos..."
rm "$DB_DUMP_FILE"
rm "$FINAL_ZIP"

# Limpieza en Google Drive (borrar archivos de más de RETENTION_DAYS días)
rclone delete --min-age "${RETENTION_DAYS}d" "$REMOTE_NAME:$REMOTE_DIR" --rmdirs

echo "--- Backup Finalizado con Éxito ---"
