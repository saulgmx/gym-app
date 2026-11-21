#!/usr/bin/env bash
# run-qwen.sh — Lanza a Qwen Code en modo headless sobre una tarea delegada (ADR-0014, piloto).
#
# BORRADOR para revisión. Vive FUERA del repo (p. ej. ~/qwen-calib/run-qwen.sh).
# Compatible con el bash 3.2 de macOS (sin mapfile ni arrays asociativos).
#
# Uso (desde la raíz del repo):
#   ~/qwen-calib/run-qwen.sh <tarea> <intento> [modelo]
#   ~/qwen-calib/run-qwen.sh 008-T11a 1
#
# Espera en ~/qwen-calib/<tarea>/:
#   brief-<intento>.md   brief de ese intento (si no existe, usa brief.md)
#   allowed.txt          archivos permitidos, una ruta por línea, relativa a la raíz del repo
#
# Escribe en ~/qwen-calib/<tarea>/:
#   attempt-<intento>.log   cabecera con metadatos + salida completa de Qwen
#   summary.tsv             una línea por intento (para la tabla de evidencia)
#
# No verifica ni revierte nada: eso lo hace Opus (pruebas, lint, mutaciones, revisión).
# Sale con 0 si Qwen terminó y no tocó archivos fuera de allowed.txt; con 1 si no.
#
# Variables opcionales:
#   QWEN_CALIB_DIR    carpeta base (por defecto ~/qwen-calib)
#   QWEN_MAX_TIME     límite de tiempo de la sesión (por defecto 20m)
#   QWEN_MAX_TURNS    límite de turnos (por defecto 40)
#   LMSTUDIO_URL      por defecto http://localhost:1234
#   QWEN_NOTIFY_URL   si se define, avisa al terminar con un POST (p. ej. un tema de ntfy.sh)

set -euo pipefail

TASK="${1:?Uso: run-qwen.sh <tarea> <intento> [modelo]}"
ATTEMPT="${2:?Uso: run-qwen.sh <tarea> <intento> [modelo]}"
MODEL="${3:-qwen/qwen3.6-35b-a3b}"

CALIB_DIR="${QWEN_CALIB_DIR:-$HOME/qwen-calib}"
TASK_DIR="$CALIB_DIR/$TASK"
MAX_TIME="${QWEN_MAX_TIME:-20m}"
MAX_TURNS="${QWEN_MAX_TURNS:-40}"
LMSTUDIO_URL="${LMSTUDIO_URL:-http://localhost:1234}"

LOG="$TASK_DIR/attempt-$ATTEMPT.log"
SUMMARY="$TASK_DIR/summary.tsv"
ALLOWED="$TASK_DIR/allowed.txt"

die() { echo "run-qwen: $*" >&2; exit 2; }

# --- 1. Precondiciones ----------------------------------------------------------------

command -v qwen >/dev/null || die "no encuentro 'qwen' en el PATH"
command -v lms  >/dev/null || die "no encuentro 'lms' (CLI de LM Studio) en el PATH"
command -v git  >/dev/null || die "no encuentro 'git'"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "no estoy dentro de un repo git"
[ "$PWD" = "$REPO_ROOT" ] || die "ejecútalo desde la raíz del repo ($REPO_ROOT)"

case "$ATTEMPT" in 1|2|3) ;; *) die "el intento debe ser 1, 2 o 3 (ADR-0014)";; esac

BRIEF="$TASK_DIR/brief-$ATTEMPT.md"
[ -f "$BRIEF" ] || BRIEF="$TASK_DIR/brief.md"
[ -s "$BRIEF" ]   || die "falta el brief: $TASK_DIR/brief-$ATTEMPT.md o $TASK_DIR/brief.md"
[ -s "$ALLOWED" ] || die "falta $ALLOWED (archivos permitidos, uno por línea)"
[ -e "$LOG" ]     && die "ya existe $LOG; ¿repetir el intento $ATTEMPT? bórralo a mano primero"

# El árbol debe estar limpio: así todo lo que cambie es de Qwen.
if [ -n "$(git status --porcelain --untracked-files=all)" ]; then
  git status --short >&2
  die "el árbol de trabajo no está limpio; haz commit o stash antes de delegar"
fi

# --- 2. LM Studio: servidor arriba y solo este modelo cargado -------------------------

curl -sf "$LMSTUDIO_URL/v1/models" >/dev/null \
  || die "LM Studio no responde en $LMSTUDIO_URL (¿servidor encendido?)"

# Precarga explícita: evita que la primera petición espere la carga JIT y agote el timeout.
if ! lms ps 2>/dev/null | grep -qF "$MODEL"; then
  echo "run-qwen: cargando $MODEL…"
  lms unload --all >/dev/null 2>&1 || true
  lms load "$MODEL" >/dev/null || die "no se pudo cargar $MODEL"
fi

# --- 3. Lanzar a Qwen -----------------------------------------------------------------

HEAD_SHA="$(git rev-parse --short HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
STARTED="$(date '+%Y-%m-%dT%H:%M:%S%z')"

{
  echo "# run-qwen"
  echo "# task=$TASK attempt=$ATTEMPT model=$MODEL"
  echo "# branch=$BRANCH head=$HEAD_SHA started=$STARTED"
  echo "# brief=$BRIEF max_time=$MAX_TIME max_turns=$MAX_TURNS"
  echo "# flags: --approval-mode auto-edit --exclude-tools run_shell_command"
  echo "# ------------------------------------------------------------"
} > "$LOG"

START=$(date +%s)
set +e
# Solo edición de archivos: sin terminal (ADR-0014). Nunca --yolo.
qwen -m "$MODEL" \
  --approval-mode auto-edit \
  --exclude-tools run_shell_command \
  --max-wall-time "$MAX_TIME" \
  --max-session-turns "$MAX_TURNS" \
  "$(cat "$BRIEF")" \
  >> "$LOG" 2>&1
EXIT=$?
set -e
DURATION=$(( $(date +%s) - START ))

# --- 4. Qué cambió y si respetó los archivos permitidos -------------------------------

CHANGED="$(git status --porcelain --untracked-files=all | sed 's/^...//' | sort)"
ALLOWED_SORTED="$(grep -v '^[[:space:]]*$' "$ALLOWED" | grep -v '^#' | sort -u)"
OUTSIDE="$(comm -23 <(printf '%s\n' "$CHANGED" | grep -v '^$' || true) \
                    <(printf '%s\n' "$ALLOWED_SORTED"))"

TOOL_ERRORS="$(grep -ciE 'tool call|ETIMEDOUT|ECONNRESET|ECONNREFUSED' "$LOG" || true)"

{
  echo "# ------------------------------------------------------------"
  echo "# exit=$EXIT duration=${DURATION}s"
  echo "# changed:"; printf '%s\n' "$CHANGED" | sed 's/^/#   /'
  echo "# outside allowed:"; printf '%s\n' "${OUTSIDE:-(ninguno)}" | sed 's/^/#   /'
  echo "# tool/connection error lines: $TOOL_ERRORS"
} >> "$LOG"

[ -f "$SUMMARY" ] || printf 'task\tattempt\tmodel\tstarted\tduration_s\texit\tfiles_changed\toutside_allowed\ttool_error_lines\thead\n' > "$SUMMARY"
printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
  "$TASK" "$ATTEMPT" "$MODEL" "$STARTED" "$DURATION" "$EXIT" \
  "$(printf '%s\n' "$CHANGED" | grep -c . || true)" \
  "$(printf '%s\n' "$OUTSIDE" | grep -c . || true)" \
  "$TOOL_ERRORS" "$HEAD_SHA" >> "$SUMMARY"

# --- 5. Resumen para Opus -------------------------------------------------------------

echo "run-qwen: $TASK intento $ATTEMPT · exit=$EXIT · ${DURATION}s · log: $LOG"
echo "run-qwen: archivos cambiados:"; printf '%s\n' "${CHANGED:-(ninguno)}" | sed 's/^/  /'

STATUS=0
if [ -n "$OUTSIDE" ]; then
  echo "run-qwen: ⚠ tocó archivos FUERA de allowed.txt (no revierto nada; decide Opus):"
  printf '%s\n' "$OUTSIDE" | sed 's/^/  /'
  STATUS=1
fi
[ "$EXIT" -eq 0 ] || { echo "run-qwen: ⚠ qwen terminó con exit=$EXIT"; STATUS=1; }
[ -n "$CHANGED" ] || { echo "run-qwen: ⚠ Qwen no cambió ningún archivo"; STATUS=1; }

if [ -n "${QWEN_NOTIFY_URL:-}" ] && [ "$STATUS" -ne 0 ]; then
  curl -s -d "Qwen $TASK intento $ATTEMPT necesita revisión (exit=$EXIT, ${DURATION}s)" \
    "$QWEN_NOTIFY_URL" >/dev/null || true
fi

exit "$STATUS"
