# Plano de Construção — ERP Implementos Rodoviários

## Decisões Arquiteturais

| Decisão | Escolha | Motivo |
|---|---|---|
| Monorepo | Turborepo + pnpm | Simples e eficaz para time pequeno |
| Backend | NestJS — **monolito modular** | Sem overhead de microserviços; módulos encapsulados |
| ORM | Prisma + raw SQL (relatórios) | Type-safety + escape hatch para queries fiscais |
| Frontend | Next.js (App Router) + shadcn/ui | SSR, componentes próprios, TanStack Table |
| Estado servidor | TanStack Query | Cache, sync automático |
| Estado cliente | Zustand | Leve, sem boilerplate |
| Formulários | React Hook Form + Zod | Performance + validação compartilhada back/front |
| Auth | NestJS Passport + JWT + CASL | Interno, RBAC por módulo |
| AI Assistant | Claude API com tool use | Assistente embutido no ERP com acesso aos dados |
| NF-e | Integração com provedor externo (Focus/Tecnospeed) | Não reinventar comunicação SEFAZ |
| Motor Fiscal | **Strategy Pattern Dual** (atual + novo + transição) | Preparado para Reforma Tributária EC 132/2023 |
| DB | PostgreSQL (instância única) | Suficiente para EPP |
| Deploy | Docker Compose em VPS | Custo-efetivo para EPP |

---

## Estrutura do Monorepo

```
erp-implementos/
├── apps/
│   ├── api/          # NestJS (backend monolito modular)
│   └── web/          # Next.js (frontend)
├── packages/
│   ├── shared/       # DTOs, types, constantes, Zod schemas
│   ├── ui/           # Componentes React compartilhados (shadcn/ui)
│   ├── db/           # Prisma schema, migrations, client
│   ├── ai/           # Integração Claude API (assistant engine)
│   └── fiscal-calc/  # Engine tributária dual (atual + reforma tributária)
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── .env.example
```

---

## Roadmap — 10 Sprints

### Sprint 1 — Fundação (INICIAR AGORA)
**Objetivo:** Monorepo funcional, auth, banco de dados, estrutura de módulos

- [x] Setup monorepo (Turborepo + pnpm)
- [ ] NestJS API com estrutura de módulos (todos os domínios como pastas vazias)
- [ ] Next.js com layout base (sidebar, header, área de conteúdo)
- [ ] Prisma schema inicial (empresa, usuário, permissões, tax_regime_config com enum ATUAL|NOVO|TRANSICAO)
- [ ] Autenticação JWT + refresh token
- [ ] RBAC básico (Guard por módulo)
- [ ] Seed com dados da empresa (CNPJ, CNAEs, CCs)
- [ ] Design system base (shadcn/ui + tema ERP)
- [ ] Tela de login + dashboard vazio

### Sprint 2 — Cadastros Base + Estoque
**Objetivo:** Cadastros fundamentais que todos os módulos usam

- [ ] Cadastro de produtos (NCM, CEST, unidade, tipo)
- [ ] Cadastro de pessoas (clientes/fornecedores — PF/PJ, CNPJ/CPF)
- [ ] Cadastro de centros de custo (CC-IND, CC-COM, CC-OFI, CC-FI, CC-ADM)
- [ ] Multi-almoxarifado (MP, WIP, PA, peças, implementos, calderaria)
- [ ] Movimentações de estoque (entrada, saída, transferência interna)
- [ ] Tabelas fiscais (NCM, CFOP, CST ICMS/PIS/COFINS/IPI + tabelas IBS/CBS preparadas)
- [ ] Município de destino obrigatório em operações (preparação para IBS destino)

### Sprint 3 — Comercial (CRM + Vendas)
**Objetivo:** Pipeline de vendas funcionando nas 3 modalidades

- [ ] CRM: leads, oportunidades, pipeline Kanban
- [ ] Contas (transportadoras, construtoras, agro, locadoras)
- [ ] Vendas — Modalidade 1: estoque próprio (pedido → faturamento)
- [ ] Vendas — Modalidade 2: venda direta (pedido ao fabricante → comissão)
- [ ] Vendas — Modalidade 3: produção própria (pedido → PCP)
- [ ] Comissões de vendedores (todas as modalidades)
- [ ] Seminovos (avaliação, precificação)
- [ ] Histórico 360° do cliente

### Sprint 4 — F&I (Financiamento, Consórcio, Seguro)
**Objetivo:** Módulos de receita recorrente funcionando

- [ ] Financiamento: simulação, proposta, acompanhamento
- [ ] FINAME/BNDES: enquadramento, proposta
- [ ] Consórcio: administradoras, venda de cotas, acompanhamento, contemplação
- [ ] Seguro: seguradoras, cotação, apólices, vigência, sinistros
- [ ] Comissões F&I (NFS-e de comissão)
- [ ] Alertas de renovação de seguro e contemplação de consórcio
- [ ] KPIs: penetração F&I, receita por produto

### Sprint 5 — Engenharia + PCP
**Objetivo:** BOM, CODP e planejamento híbrido ATO+MTO

- [ ] BOM multinível (carroceria, subconjunto ATO, componente oficina)
- [ ] CODP: classificação de itens ATO vs MTO por família
- [ ] Roteiros de fabricação (produção + calderaria)
- [ ] Configurador de produto (selecionar subconjuntos ATO + definir itens MTO)
- [ ] MPS para subconjuntos ATO (forecast/Kanban)
- [ ] MRP por pedido (explosão delta — só o que falta)
- [ ] CTP (Capable to Promise — data entrega prometida)
- [ ] Centros de trabalho + capacidade
- [ ] Gestão de revisões (ECO)

### Sprint 6 — Produção + Qualidade
**Objetivo:** Chão de fábrica digital

- [ ] Ordens de produção (subconjunto ATO, montagem MTO, componente oficina)
- [ ] Apontamento de produção (app mobile — horas + quantidades)
- [ ] Requisição de materiais (baixa estoque → WIP)
- [ ] Rastreabilidade (nº série carroceria / chassi)
- [ ] Encerramento OP (custo real vs padrão)
- [ ] Inspeção de recebimento, processo e final
- [ ] Não-conformidade (RNC, 8D)
- [ ] Painel supervisão (dashboard chão de fábrica)
- [ ] OEE por centro de trabalho

### Sprint 7 — Oficina / Calderaria
**Objetivo:** Gestão completa de OS + cadeia interna

- [ ] Abertura de OS (mecânica, calderaria, pintura, mista, garantia, interna)
- [ ] Check-in/vistoria com fotos (mobile)
- [ ] Diagnóstico + orçamento (serviços + peças + materiais calderaria)
- [ ] Requisição interna à Indústria (RI → OP-Interna no PCP)
- [ ] Apontamento de horas (mecânica + calderaria — mobile)
- [ ] Consumo de peças, materiais calderaria, componentes da Indústria
- [ ] Calderaria: plano de corte (nesting), roteiro, controle dimensional
- [ ] Garantia fabricante (abertura processo, reembolso)
- [ ] Encerramento OS (composição custo, faturamento misto NFS-e + NF-e)
- [ ] Agendamento + posição OS tempo real (portal cliente)
- [ ] NPS pós-serviço

### Sprint 8 — Fiscal / Tributário (Lucro Real + Reforma Tributária)
**Objetivo:** Conformidade fiscal completa com motor dual preparado para transição

**8A — Sistema Atual (Lucro Real):**
- [ ] Engine de cálculo tributário (ICMS débito/crédito, IPI, PIS/COFINS não-cumulativo, ISS)
- [ ] Gestão de créditos PIS/COFINS (escrituração por CST 50-56)
- [ ] Créditos ICMS (entradas + CIAP 1/48 avos)
- [ ] Créditos IPI (entradas industriais)
- [ ] Emissão NF-e via provedor (Focus/Tecnospeed)
- [ ] Emissão NFS-e (ABRASF / API municipal)
- [ ] LALUR (Parte A: adições/exclusões + Parte B: prejuízo fiscal)
- [ ] LACS (similar LALUR para CSLL)
- [ ] Apuração trimestral IRPJ 15% + adicional 10%
- [ ] Apuração trimestral CSLL 9%
- [ ] Apuração mensal PIS/COFINS (débitos - créditos - retenções)
- [ ] Apuração mensal ICMS (débitos - créditos)
- [ ] Apuração mensal IPI
- [ ] Retenções na fonte (IRRF, CSRF, ISS — sofridas e efetuadas)
- [ ] DCTF mensal
- [ ] Geração SPED: ECD, ECF, EFD-ICMS/IPI, EFD-Contribuições
- [ ] Calendário de obrigações com alertas

**8B — Reforma Tributária (EC 132/2023) — Preparação:**
- [ ] Tax Router (Strategy Pattern) — decide engine por data/configuração
- [ ] Engine IBS (destino) — alíquota por UF/município destino
- [ ] Engine CBS (destino) — alíquota federal única
- [ ] Engine IS (Imposto Seletivo) — classificação NCM
- [ ] Tabela de proporções ICMS↓/IBS↑ configurável por ano (2026-2033)
- [ ] Engine de transição — cálculo proporcional dual por período
- [ ] Gestão de créditos dual (PIS/COFINS restrito + IBS/CBS amplo)
- [ ] Split payment — cálculo valor bruto/retido/líquido
- [ ] NF-e XML versionado — campos IBS/CBS/IS quando SEFAZ publicar
- [ ] Simulador de carga tributária (atual vs novo)
- [ ] Tela de configuração da transição (para contador atualizar proporções)

### Sprint 9 — Contabilidade + Financeiro + RH
**Objetivo:** Controle financeiro e folha

- [ ] Plano de contas (padrão CFC) com centros de custo
- [ ] Lançamentos contábeis automáticos (NF-e, OS, folha)
- [ ] DRE por centro de custo (Industrial, Comercial, Oficina, F&I)
- [ ] Balanço Patrimonial
- [ ] Ativo imobilizado (depreciação → base crédito PIS/COFINS + CIAP)
- [ ] Contas a pagar (fornecedores + impostos/DARF + folha)
- [ ] Contas a receber (vendas + comissões venda direta/consórcio/seguro + OS)
- [ ] Retenções a compensar (IRRF, CSRF, ISS → abater nos DARF)
- [ ] Fluxo de caixa (projeção — preparado para split payment IBS/CBS)
- [ ] Split payment: valor bruto, retido, líquido no contas a receber
- [ ] Conciliação bancária (CNAB 240/400, OFX)
- [ ] Boleto + PIX
- [ ] Cadastro funcionários (CLT, cargos, departamentos)
- [ ] Cálculo folha (proventos, INSS patronal 20%+RAT, FGTS 8%, IRRF)
- [ ] Provisões (férias, 13º) — dedutíveis no LALUR
- [ ] Comissões vendedores na folha
- [ ] eSocial (eventos periódicos e não-periódicos)
- [ ] Controle de ponto + EPI

### Sprint 10 — Assistente IA + Portal Cliente + Refinamentos
**Objetivo:** IA embutida no ERP + portal externo + polimento

- [ ] Assistente IA (Claude API com tool use)
  - [ ] Chat sidebar no ERP
  - [ ] Tools: consultar estoque, status OS, status OP, regras fiscais
  - [ ] Tools: consultar pipeline vendas, posição financeira
  - [ ] Contexto fiscal brasileiro (Lucro Real, SPED, ICMS/IPI/PIS/COFINS)
  - [ ] Contexto Reforma Tributária (IBS, CBS, IS, split payment, transição)
  - [ ] Simulador de cenários: carga tributária atual vs novo sistema
  - [ ] System prompt com regras do negócio (carrocerias, implementos)
- [ ] Portal do cliente
  - [ ] Consulta status OS
  - [ ] Histórico de compras/serviços
  - [ ] Agendamento de revisão
- [ ] Dashboard executivo consolidado (KPIs todos os domínios)
- [ ] Relatórios gerenciais
- [ ] Documentação de uso
- [ ] Testes E2E dos fluxos críticos

---

## O que será construído AGORA (Sprint 1):

1. Inicializar monorepo com Turborepo + pnpm
2. Criar app NestJS (api) com todos os módulos como esqueleto
3. Criar app Next.js (web) com layout ERP (sidebar com todos os módulos)
4. Package `db` com Prisma schema (empresa, usuário, roles, permissões)
5. Package `shared` com types/DTOs/Zod schemas
6. Package `ui` com componentes base (shadcn/ui)
7. Autenticação completa (login, JWT, refresh, RBAC)
8. Tela de login + dashboard com navegação por todos os módulos
9. Seed com dados iniciais da empresa

### Arquivos a criar no Sprint 1:

```
erp-implementos/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── .gitignore
│
├── packages/
│   ├── db/
│   │   ├── package.json
│   │   └── prisma/
│   │       └── schema.prisma          # Empresa, User, Role, Permission
│   ├── shared/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── dto/                   # DTOs compartilhados
│   │       ├── types/                 # Tipos TypeScript
│   │       └── validation/            # Schemas Zod
│   └── ui/
│       ├── package.json
│       └── src/
│           └── components/            # shadcn/ui base
│
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       └── modules/
│   │           ├── core/
│   │           │   ├── auth/          # JWT, Guards, RBAC
│   │           │   └── common/        # Base entities, decorators
│   │           ├── industrial/
│   │           │   ├── engineering/
│   │           │   ├── pcp/
│   │           │   ├── production/
│   │           │   └── quality/
│   │           ├── commercial/
│   │           │   ├── crm/
│   │           │   ├── sales/
│   │           │   └── fi/
│   │           ├── workshop/
│   │           │   ├── service-order/
│   │           │   ├── calderaria/
│   │           │   └── requisition/
│   │           ├── corporate/
│   │           │   ├── fiscal/
│   │           │   ├── accounting/
│   │           │   ├── financial/
│   │           │   ├── hr/
│   │           │   ├── purchasing/
│   │           │   └── inventory/
│   │           └── ai/
│   │               └── assistant/
│   │
│   └── web/
│       ├── package.json
│       ├── next.config.js
│       ├── tailwind.config.ts
│       └── src/
│           ├── app/
│           │   ├── layout.tsx         # Layout raiz
│           │   ├── page.tsx           # Redirect to login/dashboard
│           │   ├── login/
│           │   │   └── page.tsx
│           │   └── (erp)/
│           │       ├── layout.tsx     # Layout ERP (sidebar + header)
│           │       ├── dashboard/
│           │       ├── industrial/
│           │       ├── comercial/
│           │       ├── oficina/
│           │       ├── fi/
│           │       ├── fiscal/
│           │       ├── contabilidade/
│           │       ├── financeiro/
│           │       ├── rh/
│           │       ├── compras/
│           │       ├── estoque/
│           │       └── configuracoes/
│           ├── components/
│           │   ├── layout/
│           │   │   ├── sidebar.tsx
│           │   │   ├── header.tsx
│           │   │   └── ai-chat.tsx   # Sidebar do assistente IA
│           │   └── ui/               # shadcn/ui components
│           ├── lib/
│           │   ├── api.ts            # Axios/fetch client
│           │   └── auth.ts           # Auth helpers
│           └── stores/
│               └── ui-store.ts       # Zustand (sidebar, theme)
```
