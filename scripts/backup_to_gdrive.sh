#!/bin/bash

# ==============================================================================
# Backup automático para Cajón de Facturas
# - Vuelca la base de datos PostgreSQL
# - Empaqueta los ficheros de facturas (backend/uploads)
# - Deja copia local en backups/
# - Si rclone está instalado/configurado, sube una copia a Google Drive
# ==============================================================================

set -Eeuo pipefail

PROJECT_ROOT="/home/charly/facturas"
BACKUP_ROOT="$PROJECT_ROOT/backups"
BACKUP_TEMP_DIR="$BACKUP_ROOT/temp"
UPLOADS_DIR="$PROJECT_ROOT/backend/uploads"
ENV_FILE="$PROJECT_ROOT/backend/.env"
LOG_PREFIX="[BACKUP-FACTURAS]"

# Configuración remota opcional. Puede sobreescribirse desde .env si se desea.
REMOTE_NAME="${BACKUP_REMOTE_NAME:-remote}"
REMOTE_DIR="${BACKUP_REMOTE_DIR:-Facturas_Backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
RCLONE_BIN="${RCLONE_BIN:-/home/charly/bin/rclone}"

mkdir -p "$BACKUP_ROOT" "$BACKUP_TEMP_DIR"

cleanup() {
    if [[ -n "${DB_DUMP_FILE:-}" && -f "$DB_DUMP_FILE" ]]; then rm -f "$DB_DUMP_FILE"; fi
}
trap cleanup EXIT

# Cargar variables de entorno, especialmente DATABASE_URL
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
else
    echo "$LOG_PREFIX ERROR: No se encontró el archivo .env en $ENV_FILE"
    exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "$LOG_PREFIX ERROR: DATABASE_URL no está definido en $ENV_FILE"
    exit 1
fi

if [[ ! -d "$UPLOADS_DIR" ]]; then
    echo "$LOG_PREFIX ERROR: No existe la carpeta de facturas: $UPLOADS_DIR"
    exit 1
fi

TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_NAME="backup_facturas_$TIMESTAMP"
DB_DUMP_FILE="$BACKUP_TEMP_DIR/db_$TIMESTAMP.sql"
FINAL_ZIP="$BACKUP_ROOT/$BACKUP_NAME.tar.gz"

start_ts=$(date +%s)
echo "$LOG_PREFIX --- Inicio: $TIMESTAMP ---"

# 1. Volcado de la base de datos
echo "$LOG_PREFIX [1/4] Volcando base de datos PostgreSQL..."
pg_dump "$DATABASE_URL" > "$DB_DUMP_FILE"
echo "$LOG_PREFIX OK: dump creado: $DB_DUMP_FILE"

# 2. Compresión de DB + ficheros de facturas
echo "$LOG_PREFIX [2/4] Comprimiendo dump y uploads..."
tar -czf "$FINAL_ZIP" \
    -C "$PROJECT_ROOT" "backend/uploads" \
    -C "$BACKUP_TEMP_DIR" "$(basename "$DB_DUMP_FILE")"

if [[ ! -s "$FINAL_ZIP" ]]; then
    echo "$LOG_PREFIX ERROR: El archivo comprimido no se creó correctamente: $FINAL_ZIP"
    exit 1
fi

echo "$LOG_PREFIX OK: backup local creado: $FINAL_ZIP ($(du -h "$FINAL_ZIP" | awk '{print $1}'))"

# 3. Subida remota opcional
echo "$LOG_PREFIX [3/4] Subida remota opcional..."
if [[ "${SKIP_REMOTE_BACKUP:-0}" == "1" ]]; then
    echo "$LOG_PREFIX INFO: Subida remota omitida por SKIP_REMOTE_BACKUP=1"
elif [[ -x "$RCLONE_BIN" ]]; then
    if "$RCLONE_BIN" copy "$FINAL_ZIP" "$REMOTE_NAME:$REMOTE_DIR"; then
        echo "$LOG_PREFIX OK: subida completada a $REMOTE_NAME:$REMOTE_DIR"
        "$RCLONE_BIN" delete --min-age "${RETENTION_DAYS}d" "$REMOTE_NAME:$REMOTE_DIR" --rmdirs || \
            echo "$LOG_PREFIX AVISO: no se pudo limpiar retención remota"
    else
        echo "$LOG_PREFIX AVISO: falló la subida remota. La copia local queda conservada en $FINAL_ZIP"
    fi
else
    echo "$LOG_PREFIX AVISO: rclone no está instalado en $RCLONE_BIN. La copia local queda conservada en $FINAL_ZIP"
fi

# 4. Limpieza local de temporales y backups antiguos
echo "$LOG_PREFIX [4/4] Limpiando temporales y backups locales antiguos..."
rm -f "$DB_DUMP_FILE"
find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'backup_facturas_*.tar.gz' -mtime +"$RETENTION_DAYS" -print -delete

end_ts=$(date +%s)
echo "$LOG_PREFIX --- Fin correcto. Duración: $((end_ts - start_ts))s ---"
