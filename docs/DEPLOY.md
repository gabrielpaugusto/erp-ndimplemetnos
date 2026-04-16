# Como fazer Deploy do ERP na Nuvem

## Visão Geral do Fluxo

```
Você no Windows            GitHub                    VPS (servidor)
    │                         │                           │
    ├─ git push main ────────►│                           │
    │                         ├─ Build API (Docker) ──────┤
    │                         ├─ Build Web (Docker) ──────┤
    │                         ├─ Push imagens → ghcr.io ──┤
    │                         ├─ SSH no servidor ─────────►│
    │                         │                           ├─ docker pull
    │                         │                           ├─ docker compose up
    │                         │                           └─ ✅ online
```

Cada `git push` para `main` dispara o deploy automaticamente. Leva ~5 minutos.

---

## Passo a Passo (uma vez só)

### 1. Contrate um VPS
- **Mínimo recomendado:** 2 vCPU / 4 GB RAM / 40 GB SSD
- Provedores: DigitalOcean, Hetzner, Hostinger VPS, Contabo
- Sistema operacional: **Ubuntu 22.04 LTS**

### 2. Configure o DNS
No painel do seu domínio, crie um registro A:
```
erp.seudominio.com.br  →  IP_DO_SERVIDOR
```
Aguarde a propagação (pode levar até 1h).

### 3. Execute o setup no servidor
Conecte via SSH e rode:
```bash
curl -fsSL https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPO/main/scripts/setup-server.sh | sudo bash
```
Isso instala Docker, Nginx, Certbot (SSL automático) e cria a estrutura de diretórios.

### 4. Configure o .env.production no servidor
```bash
# No servidor:
nano /opt/erp/.env.production
```
Preencha baseado no modelo `.env.production.example` do repositório.

### 5. Configure os Secrets no GitHub
No repositório → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
|--------|-------|
| `VPS_HOST` | IP do seu servidor (ex: `192.168.1.100`) |
| `VPS_USER` | Usuário SSH (ex: `root` ou `ubuntu`) |
| `VPS_SSH_KEY` | Conteúdo da chave privada SSH (`~/.ssh/id_rsa`) |
| `VPS_PORT` | Porta SSH (padrão: `22`) |

**Como gerar a chave SSH (se não tiver):**
```bash
# No seu computador local (Windows PowerShell):
ssh-keygen -t ed25519 -C "deploy-erp"

# Copie a chave pública para o servidor:
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh usuario@IP_SERVIDOR "cat >> ~/.ssh/authorized_keys"

# O Secret VPS_SSH_KEY é o conteúdo de:
type $env:USERPROFILE\.ssh\id_ed25519
```

### 6. Faça o primeiro push
```bash
git add .
git commit -m "feat: configuração CI/CD automático"
git push origin main
```

Acompanhe em: **GitHub → Actions → Build & Deploy**

---

## Atualizando o ERP

Simplesmente faça suas alterações localmente e:
```bash
git add .
git commit -m "sua mensagem"
git push
```
O deploy ocorre automaticamente. Banco de dados, Redis e MinIO **não são reiniciados** — apenas a API e o Frontend são atualizados.

---

## Verificando se está funcionando

```bash
# No servidor, verifique os containers:
docker ps

# Logs da API:
docker logs erp-api -f

# Logs do Frontend:
docker logs erp-web -f

# Logs do Nginx:
docker logs erp-nginx -f
```

---

## Domínio e SSL

O SSL é gerado automaticamente pelo Let's Encrypt no `setup-server.sh`.
Renovação automática já configurada (diária às 03:00).

Edite o domínio em:
- `nginx/erp.conf` — substitua `erp.seudominio.com.br`
- `scripts/setup-server.sh` — variável `DOMAIN`
- `.env.production` — `NEXT_PUBLIC_API_URL` e `NEXTAUTH_URL`

---

## Fazendo Backup do Banco

```bash
# No servidor:
docker exec erp-postgres pg_dump -U erp_user erp_prod | gzip > /opt/erp/backup_$(date +%Y%m%d).sql.gz
```

---

## Estrutura de Arquivos no Servidor

```
/opt/erp/
├── .env.production          ← variáveis secretas (NÃO vai para o Git)
├── docker-compose.cloud.yml ← copiado pelo CI a cada deploy
├── nginx/
│   └── erp.conf             ← copiado pelo CI a cada deploy
└── certs/
    └── certificado.pfx      ← certificado A1 para emissão de NF-e
```
