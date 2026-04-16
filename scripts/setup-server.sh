#!/bin/bash
# ============================================================================
# setup-server.sh — Configuração inicial do VPS para o ERP ND Implementos
#
# Execute UMA VEZ no servidor zerado (Ubuntu 22.04/24.04):
#   curl -fsSL https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPO/main/scripts/setup-server.sh | bash
#
# Ou copie o arquivo e execute:
#   chmod +x setup-server.sh && sudo ./setup-server.sh
# ============================================================================

set -euo pipefail

DOMAIN="erp.ndimplementos.com.br"
EMAIL="ti@ndimplementos.com.br"
REPO_URL="https://github.com/gabrielpaugusto/erp-ndimplemetnos.git"

echo "============================================"
echo " Setup ERP ND Implementos — Servidor"
echo "============================================"

# ── 1. Atualiza o sistema ────────────────────────────────────────────────────
echo "📦 Atualizando pacotes..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Instala Docker ───────────────────────────────────────────────────────
echo "🐳 Instalando Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "  Docker já instalado."
fi

# Adiciona usuário atual ao grupo docker
usermod -aG docker "$SUDO_USER" 2>/dev/null || true

# ── 3. Instala Docker Compose plugin ────────────────────────────────────────
echo "🔧 Instalando Docker Compose..."
if ! docker compose version &> /dev/null; then
  apt-get install -y docker-compose-plugin
fi

# ── 4. Instala Nginx + Certbot ───────────────────────────────────────────────
echo "🌐 Instalando Nginx e Certbot..."
apt-get install -y nginx certbot python3-certbot-nginx

# ── 5. Abre portas no firewall ───────────────────────────────────────────────
echo "🔥 Configurando firewall (UFW)..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

# ── 6. Cria diretório do projeto ─────────────────────────────────────────────
echo "📁 Criando diretório /opt/erp..."
mkdir -p /opt/erp/nginx
mkdir -p /opt/erp/certs    # certificados A1 (NFe)
cd /opt/erp

# ── 7. Cria o .env.production (se não existir) ──────────────────────────────
if [ ! -f /opt/erp/.env.production ]; then
  echo ""
  echo "⚠️  IMPORTANTE: Crie o arquivo /opt/erp/.env.production"
  echo "   Modelo disponível em .env.production.example no repositório."
  echo ""
  # Cria um placeholder para não travar o compose
  cat > /opt/erp/.env.production <<'EOF'
# Preencha este arquivo com os valores reais antes de iniciar o ERP
POSTGRES_PASSWORD=PREENCHER
REDIS_PASSWORD=PREENCHER
MINIO_ACCESS_KEY=PREENCHER
MINIO_SECRET_KEY=PREENCHER
JWT_SECRET=PREENCHER
ANTHROPIC_API_KEY=PREENCHER
ENCRYPTION_KEY=PREENCHER
EOF
fi

# ── 8. Gera certificado SSL (Let's Encrypt) ──────────────────────────────────
echo "🔒 Gerando certificado SSL para $DOMAIN..."

# Configura nginx temporário para o desafio HTTP
cat > /etc/nginx/sites-enabled/default <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'OK'; }
}
NGINX

systemctl reload nginx

# Cria webroot
mkdir -p /var/www/certbot

# Obtém certificado
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  certbot certonly --webroot \
    --webroot-path /var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    -d "$DOMAIN"
  echo "✅ Certificado SSL gerado com sucesso!"
else
  echo "  Certificado já existe, pulando."
fi

# Renovação automática (cron diário)
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker exec erp-nginx nginx -s reload") | crontab -

# ── 9. Instala o nginx.conf do projeto ──────────────────────────────────────
echo "📝 Instalando nginx/erp.conf..."
# Será copiado pelo GitHub Actions a cada deploy
echo "  (será instalado automaticamente pelo CI/CD)"

# ── 10. Para o nginx do sistema (o nginx rodará dentro do Docker) ────────────
echo "🔄 Desativando nginx do sistema (usaremos o do Docker)..."
systemctl stop nginx
systemctl disable nginx

# ── 11. Cria serviço systemd para garantir reinício automático do compose ────
cat > /etc/systemd/system/erp.service <<SYSTEMD
[Unit]
Description=ERP ND Implementos
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/erp
ExecStart=/usr/bin/docker compose -f /opt/erp/docker-compose.cloud.yml up -d
ExecStop=/usr/bin/docker compose -f /opt/erp/docker-compose.cloud.yml down

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable erp

echo ""
echo "============================================"
echo " ✅ Servidor configurado com sucesso!"
echo "============================================"
echo ""
echo " Próximos passos:"
echo " 1. Edite /opt/erp/.env.production com os valores reais"
echo " 2. Coloque o certificado A1 em /opt/erp/certs/certificado.pfx"
echo " 3. Aponte o DNS: $DOMAIN → $(curl -s ifconfig.me)"
echo " 4. Configure os Secrets no GitHub (veja README-deploy.md)"
echo " 5. Faça um git push para main — o deploy ocorrerá automaticamente"
echo ""
echo " Secrets necessários no GitHub:"
echo "   VPS_HOST    = $(curl -s ifconfig.me)"
echo "   VPS_USER    = $SUDO_USER (ou root)"
echo "   VPS_SSH_KEY = (conteúdo da chave privada SSH)"
echo "   VPS_PORT    = 22"
