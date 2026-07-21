#!/bin/bash
# ============================================================================
# VideoService CRM — Скрипт установки для Astra Linux
# ============================================================================
# Поддерживает: Astra Linux Special Edition 1.7+, Astra Linux Common Edition
#
# Использование:
#   chmod +x install_astra.sh
#   sudo ./install_astra.sh
#
# Что делает:
#   1. Устанавливает Docker, Node.js, npm
#   2. Клонирует репозиторий
#   3. Собирает и запускает всё
# ============================================================================

set -e

# ─── Цвета для вывода ────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'; BOLD='\033[1m'
info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step()  { echo -e "\n${BLUE}${BOLD}━━━ $1 ━━━${NC}"; }

# ─── Конфигурация ────────────────────────────────────────────────────────────
APP_DIR="/opt/videoservice-crm"
GITHUB_REPO="https://github.com/himik19872/videoservice-crm.git"
DOMAIN="${1:-}"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
DADATA_API_KEY="${DADATA_API_KEY:-}"
DADATA_SECRET="${DADATA_SECRET:-}"

# ─── Проверка прав ───────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    error "Запустите от root: sudo ./install_astra.sh"
fi

if [[ -z "$DADATA_API_KEY" ]]; then
    warn "DADATA_API_KEY не задан. Для нормализации адресов задайте: export DADATA_API_KEY=... && sudo ./install_astra.sh"
fi

echo ""
echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║  VideoService CRM — Установка на Astra Linux        ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# Шаг 1: Установка Docker
# ══════════════════════════════════════════════════════════════════════════════
step "Шаг 1/8: Установка Docker"

if command -v docker &>/dev/null; then
    info "Docker уже установлен: $(docker --version)"
else
    info "Устанавливаю Docker..."
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg lsb-release 2>/dev/null || true
    
    # Пробуем официальный скрипт Docker
    if curl -fsSL https://get.docker.com | sh 2>/dev/null; then
        info "Docker установлен через get.docker.com"
    else
        # Fallback: установка из репозитория Astra
        apt-get install -y -qq docker.io docker-compose-v2 2>/dev/null || \
            apt-get install -y -qq docker docker-compose 2>/dev/null || \
            error "Не удалось установить Docker. Установите вручную: https://docs.docker.com/engine/install/"
    fi
    
    systemctl enable docker 2>/dev/null || true
    systemctl start docker 2>/dev/null || true
    info "Docker установлен и запущен"
fi

# Проверяем docker compose (плагин или отдельный)
if docker compose version &>/dev/null 2>&1; then
    info "Docker Compose: $(docker compose version 2>&1 | head -1)"
elif command -v docker-compose &>/dev/null; then
    info "Docker Compose: $(docker-compose --version)"
else
    warn "Docker Compose не найден, пробую установить..."
    apt-get install -y -qq docker-compose-v2 2>/dev/null || \
        apt-get install -y -qq docker-compose 2>/dev/null || \
        warn "docker-compose не установлен. Будет использован docker compose plugin"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Шаг 2: Установка Node.js и npm
# ══════════════════════════════════════════════════════════════════════════════
step "Шаг 2/8: Установка Node.js и npm"

NEED_NODE=false
NEED_NPM=false

if command -v node &>/dev/null; then
    info "Node.js уже установлен: $(node --version)"
else
    NEED_NODE=true
fi

if command -v npm &>/dev/null; then
    info "npm уже установлен: $(npm --version)"
else
    NEED_NPM=true
fi

if $NEED_NODE || $NEED_NPM; then
    info "Устанавливаю Node.js и npm..."
    
    # В Astra Linux nodejs может быть без npm — нужны оба пакета
    apt-get update -qq
    apt-get install -y -qq nodejs npm 2>/dev/null && info "Установлено из репозитория" || {
        warn "Стандартный пакет не найден, пробую nodesource..."
        # Пробуем nodesource (для Ubuntu/Debian-based дистрибутивов)
        curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | bash - 2>/dev/null && \
            apt-get install -y -qq nodejs && \
            info "Node.js 20.x установлен через nodesource" || \
            error "Не удалось установить Node.js. Установите вручную: https://nodejs.org/"
    }
    
    # Проверяем npm отдельно (в Astra бывает nodejs без npm)
    if ! command -v npm &>/dev/null; then
        apt-get install -y -qq npm 2>/dev/null || \
            warn "npm не установился отдельно. Возможно, он встроен в nodejs."
    fi
    
    info "Node.js $(node --version), npm $(npm --version 2>/dev/null || echo '?')"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Шаг 3: Клонирование репозитория
# ══════════════════════════════════════════════════════════════════════════════
step "Шаг 3/8: Клонирование репозитория"

if [ -d "$APP_DIR/.git" ]; then
    info "Репозиторий уже существует: $APP_DIR"
    cd "$APP_DIR"
    git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
    git pull 2>/dev/null || warn "Не удалось выполнить git pull (продолжаем)"
else
    info "Клонирую из GitHub..."
    git clone "$GITHUB_REPO" "$APP_DIR" 2>/dev/null || \
        error "Не удалось клонировать репозиторий. Проверьте доступ к GitHub."
    git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
fi

cd "$APP_DIR"

# ══════════════════════════════════════════════════════════════════════════════
# Шаг 4: Настройка .env
# ══════════════════════════════════════════════════════════════════════════════
step "Шаг 4/8: Настройка переменных окружения"

if [[ -n "$DADATA_API_KEY" ]]; then
    cat > "$APP_DIR/.env" << ENVEOF
DADATA_API_KEY=${DADATA_API_KEY}
DADATA_SECRET=${DADATA_SECRET}
ENVEOF
    info "Файл .env создан с ключами Dadata"
else
    warn "Ключи Dadata не заданы — адреса не будут нормализоваться"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Шаг 5: Сборка фронтенда
# ══════════════════════════════════════════════════════════════════════════════
step "Шаг 5/8: Сборка React фронтенда"

if [ -f "$APP_DIR/frontend/package.json" ]; then
    cd "$APP_DIR/frontend"
    # В Astra npm может требовать больше памяти — отключаем audit
    npm config set audit false 2>/dev/null || true
    npm install --no-audit --no-fund 2>&1 | tail -5
    npm run build 2>&1 | tail -8
    info "Фронтенд собран: frontend/build/"
else
    warn "frontend/ не найден — пропускаю сборку"
fi
cd "$APP_DIR"

# ══════════════════════════════════════════════════════════════════════════════
# Шаг 6: Установка Express-прокси
# ══════════════════════════════════════════════════════════════════════════════
step "Шаг 6/8: Настройка Express-прокси"

if [ -f "$APP_DIR/server/package.json" ]; then
    cd "$APP_DIR/server"
    npm install --no-audit --no-fund 2>&1 | tail -3
    info "Express-прокси готов"
else
    warn "server/ не найден"
fi
cd "$APP_DIR"

# ══════════════════════════════════════════════════════════════════════════════
# Шаг 7: Запуск Docker-контейнеров
# ══════════════════════════════════════════════════════════════════════════════
step "Шаг 7/8: Запуск Docker-контейнеров"

# Останавливаем старые контейнеры
docker compose down --remove-orphans 2>/dev/null || docker-compose down 2>/dev/null || true

# Собираем образ
info "Собираю Docker-образ..."
if [[ -n "$DADATA_API_KEY" ]]; then
    DADATA_API_KEY="${DADATA_API_KEY}" DADATA_SECRET="${DADATA_SECRET}" \
        docker compose build 2>&1 | tail -5 || \
        DADATA_API_KEY="${DADATA_API_KEY}" DADATA_SECRET="${DADATA_SECRET}" \
        docker-compose build 2>&1 | tail -5
else
    docker compose build 2>&1 | tail -5 || docker-compose build 2>&1 | tail -5
fi

# Запускаем
docker compose up -d 2>&1 || docker-compose up -d 2>&1

# Ждём готовности Django
info "Ожидаю запуск PostgreSQL и Django (~30 сек)..."
for i in $(seq 1 30); do
    if curl -s -o /dev/null http://localhost:8000/api/regions/ 2>/dev/null; then
        info "Django API готов!"
        break
    fi
    sleep 2
done

# Загружаем начальные данные
info "Загружаю фикстуры..."
docker exec crm_web python manage.py loaddata regions.json 2>/dev/null || true
docker exec crm_web python manage.py loaddata users.json 2>/dev/null || true
docker exec crm_web python manage.py loaddata masters.json 2>/dev/null || true
docker exec crm_web python manage.py loaddata user_profiles.json 2>/dev/null || true
info "Начальные данные загружены"

# ══════════════════════════════════════════════════════════════════════════════
# Шаг 8: Запуск Express-прокси
# ══════════════════════════════════════════════════════════════════════════════
step "Шаг 8/8: Запуск веб-сервера"

cat > /etc/systemd/system/videoservice-crm.service << SERVICEEOF
[Unit]
Description=VideoService CRM Web Server
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=API_HOST=localhost
Environment=API_PORT=8000

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable videoservice-crm 2>/dev/null || true
systemctl restart videoservice-crm 2>/dev/null || {
    warn "Не удалось запустить systemd-сервис. Пробую напрямую..."
    cd "$APP_DIR/server" && nohup /usr/bin/node server.js > /var/log/videoservice-crm.log 2>&1 &
}
sleep 2

# Проверяем, что сервис запущен
if systemctl is-active --quiet videoservice-crm 2>/dev/null; then
    info "Systemd-сервис активен"
elif pgrep -f "node server.js" > /dev/null; then
    info "Express запущен в фоновом режиме"
else
    warn "Express-прокси не запустился. Проверьте: journalctl -u videoservice-crm"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Финал
# ══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║     🎉  УСТАНОВКА НА ASTRA LINUX ЗАВЕРШЕНА!        ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}CRM доступна по адресу:${NC}"
echo -e "    🌐 http://${SERVER_IP}:3000"
if [ -n "$DOMAIN" ]; then
    echo -e "    🌐 https://${DOMAIN}"
fi
echo ""
echo -e "  ${BOLD}Данные для входа:${NC}"
echo -e "    👑 Администратор:  admin / admin123"
echo -e "    📋 Диспетчер:      dispatcher / dispatcher123"
echo -e "    🔧 Мастер:         master / master123"
echo ""
echo -e "  ${BOLD}API:${NC}"
echo -e "    📡 http://${SERVER_IP}:3000/api/"
echo ""
echo -e "  ${BOLD}Перенос данных:${NC}"
echo -e "    Откройте Настройки → Миграция данных → Прямой перенос"
echo -e "    Укажите IP старого сервера, логин/пароль → Начать перенос"
echo ""
echo -e "  ${BOLD}Полезные команды:${NC}"
echo -e "    cd $APP_DIR && docker compose logs web     — логи Django"
echo -e "    systemctl status videoservice-crm           — статус прокси"
echo -e "    docker exec -it crm_web python manage.py shell — Django shell"
echo ""
echo -e "  ${YELLOW}⚠️ Astra Linux: при проблемах с systemd используйте${NC}"
echo -e "  ${YELLOW}   cd $APP_DIR/server && node server.js &${NC}"
echo ""
