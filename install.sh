#!/bin/bash
# ============================================================================
# VideoService CRM — Скрипт установки одной командой
# ============================================================================
# Поддерживает: Ubuntu 20.04+/22.04+/24.04, Debian 11+/12+
#
# Использование:
#   chmod +x install.sh
#   sudo ./install.sh
#
# Что делает:
#   1. Устанавливает Docker, Node.js, Python
#   2. Клонирует репозиторий (или использует текущую папку)
#   3. Собирает и запускает всё одной командой
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
DOMAIN="${1:-}"            # Можно передать домен: sudo ./install.sh crm.mydomain.ru
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

# ─── Проверка прав ───────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    error "Запустите от root: sudo ./install.sh"
fi

echo ""
echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║     VideoService CRM — Автоматическая установка      ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# Шаг 1: Установка Docker
# ══════════════════════════════════════════════════════════════════════════════
step "Шаг 1/7: Установка Docker и Docker Compose"

if command -v docker &>/dev/null; then
    info "Docker уже установлен: $(docker --version)"
else
    info "Устанавливаю Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    info "Docker установлен"
fi

if command -v docker-compose &>/dev/null; then
    info "Docker Compose уже установлен"
elif docker compose version &>/dev/null 2>&1; then
    info "Docker Compose плагин доступен"
else
    info "Устанавливаю Docker Compose плагин..."
    apt-get update -qq && apt-get install -y -qq docker-compose-plugin 2>/dev/null || \
        curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose
    info "Docker Compose установлен"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Шаг 2: Установка Node.js
# ══════════════════════════════════════════════════════════════════════════════
step "Шаг 2/7: Установка Node.js"

if command -v node &>/dev/null; then
    info "Node.js уже установлен: $(node --version)"
else
    info "Устанавливаю Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
    info "Node.js $(node --version) установлен"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Шаг 3: Клонирование репозитория
# ══════════════════════════════════════════════════════════════════════════════
step "Шаг 3/7: Клонирование репозитория"

if [ -d "$APP_DIR/.git" ]; then
    info "Репозиторий уже существует: $APP_DIR"
    cd "$APP_DIR"
    git pull 2>/dev/null || warn "Не удалось выполнить git pull (продолжаем)"
elif [ -d "/home/himik/crm" ]; then
    info "Использую локальную копию: /home/himik/crm → $APP_DIR"
    cp -r /home/himik/crm "$APP_DIR"
else
    info "Клонирую из GitHub..."
    mkdir -p "$APP_DIR"
    git clone "$GITHUB_REPO" "$APP_DIR" 2>/dev/null || \
        error "Не удалось клонировать репозиторий. Проверь GITHUB_REPO в скрипте."
fi

cd "$APP_DIR"

# ══════════════════════════════════════════════════════════════════════════════
# Шаг 4: Сборка фронтенда
# ══════════════════════════════════════════════════════════════════════════════
step "Шаг 4/7: Сборка React фронтенда"

if [ -f "$APP_DIR/frontend/package.json" ]; then
    cd "$APP_DIR/frontend"
    npm install --silent 2>&1 | tail -3
    npm run build 2>&1 | tail -5
    info "Фронтенд собран: frontend/build/"
else
    warn "frontend/ не найден — пропускаю сборку"
fi
cd "$APP_DIR"

# ══════════════════════════════════════════════════════════════════════════════
# Шаг 5: Установка Node-сервера (Express прокси)
# ══════════════════════════════════════════════════════════════════════════════
step "Шаг 5/7: Настройка Express-прокси"

if [ -f "$APP_DIR/server/package.json" ]; then
    cd "$APP_DIR/server"
    npm install --silent 2>&1 | tail -3
    info "Express-прокси готов"
else
    warn "server/ не найден"
fi
cd "$APP_DIR"

# ══════════════════════════════════════════════════════════════════════════════
# Шаг 6: Запуск Docker-контейнеров (PostgreSQL + Django)
# ══════════════════════════════════════════════════════════════════════════════
step "Шаг 6/7: Запуск Docker-контейнеров"

# Останавливаем старые контейнеры если есть
docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true

# Пересобираем образ (важно после обновления кода!)
info "Собираю Docker-образ..."
docker compose build --no-cache 2>&1 || docker-compose build --no-cache 2>&1

# Запускаем
docker compose up -d 2>&1 || docker-compose up -d 2>&1

# Ждём готовности
info "Ожидаю запуск PostgreSQL и Django (это может занять ~30 сек)..."
for i in $(seq 1 30); do
    if curl -s -o /dev/null http://localhost:8000/api/regions/ 2>/dev/null; then
        info "Django API готов"
        break
    fi
    sleep 2
done

# Загружаем фикстуры (начальные данные)
info "Загружаю начальные данные..."
docker exec crm_web python manage.py loaddata regions.json 2>/dev/null || true
docker exec crm_web python manage.py loaddata users.json 2>/dev/null || true
docker exec crm_web python manage.py loaddata masters.json 2>/dev/null || true
docker exec crm_web python manage.py loaddata user_profiles.json 2>/dev/null || true
info "Начальные данные загружены"

# ══════════════════════════════════════════════════════════════════════════════
# Шаг 7: Запуск Express-прокси (фронтенд + API)
# ══════════════════════════════════════════════════════════════════════════════
step "Шаг 7/7: Запуск веб-сервера"

# Создаём systemd-сервис для автозапуска
cat > /etc/systemd/system/videoservice-crm.service << 'SERVICEEOF'
[Unit]
Description=VideoService CRM Web Server
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=APP_DIR_PLACEHOLDER/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICEEOF

sed -i "s|APP_DIR_PLACEHOLDER|$APP_DIR|g" /etc/systemd/system/videoservice-crm.service

systemctl daemon-reload
systemctl enable videoservice-crm
systemctl restart videoservice-crm
sleep 2
info "Systemd-сервис создан и запущен"

# ══════════════════════════════════════════════════════════════════════════════
# Финал
# ══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║           🎉  УСТАНОВКА ЗАВЕРШЕНА!                  ║${NC}"
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
echo -e "    📡 http://${SERVER_IP}:8000/api/ (напрямую Django)"
echo ""
echo -e "  ${BOLD}Max webhook:${NC}"
echo -e "    🤖 http://${SERVER_IP}:3000/api/max/webhook/"
echo ""
echo -e "  ${BOLD}Полезные команды:${NC}"
echo -e "    docker compose logs web     — логи Django"
echo -e "    systemctl status videoservice-crm — статус прокси"
echo -e "    docker exec -it crm_web python manage.py shell — Django shell"
echo ""
echo -e "  ${YELLOW}⚠️  Не забудь настроить Max-бота в разделе «Системные настройки»!${NC}"
echo ""
