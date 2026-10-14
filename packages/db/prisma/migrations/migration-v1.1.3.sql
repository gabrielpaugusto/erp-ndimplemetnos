-- ============================================================
-- Migration v1.1.2 → v1.1.3
-- Reforma Tributária LC 214/2025 — Gaps #4-#10 + NT 009 + detPag
-- Executar em: erp-postgres-prod (banco de produção)
-- Comando: docker exec erp-postgres-prod psql -U erp_prod_user -d erp_prod -f /tmp/migration-v1.1.3.sql
-- ============================================================

BEGIN;

-- ── 1. FiscalBrain CBS/IBS (Gap #8 + FiscalBrain CBS) ────────────────────────
ALTER TABLE fiscal_brain_decisions
  ADD COLUMN IF NOT EXISTS regime2027      BOOLEAN        NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cstIbsCbs"    VARCHAR(3),
  ADD COLUMN IF NOT EXISTS "aliquotaCbs"  NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS "aliquotaIbsUf"  NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS "aliquotaIbsMun" NUMERIC(8,4);

-- ── 2. NF-e detPag — formas de pagamento reais (grupo YA) ────────────────────
CREATE TABLE IF NOT EXISTS nfe_det_pag (
  id            VARCHAR(30)    NOT NULL PRIMARY KEY,
  "nfeId"       VARCHAR(30)    NOT NULL REFERENCES nfe_documents(id) ON DELETE CASCADE,
  ordem         INTEGER        NOT NULL DEFAULT 1,
  "indPag"      INTEGER,
  "tPag"        VARCHAR(2)     NOT NULL,
  "xPag"        VARCHAR(60),
  "vPag"        NUMERIC(15,2)  NOT NULL,
  "dVenc"       TIMESTAMP,
  "tpIntegra"   INTEGER,
  "cnpjCred"    VARCHAR(14),
  "tBand"       VARCHAR(2),
  "cAut"        VARCHAR(20),
  "createdAt"   TIMESTAMP      NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMP      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nfe_det_pag_nfe_ordem ON nfe_det_pag ("nfeId", ordem);
ALTER TABLE nfe_documents ADD COLUMN IF NOT EXISTS "vTroco" DOUBLE PRECISION;

-- ── 3. NT 009 NFS-e — grupos tribMun, indExigISSQN, descontos ────────────────
ALTER TABLE nfse_emitidas
  ADD COLUMN IF NOT EXISTS "cRegTrib"          INTEGER        DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "cRegEspTrib"       INTEGER        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "indSN"             INTEGER        DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "cMunFg"            VARCHAR(7),
  ADD COLUMN IF NOT EXISTS "indExigIssqn"      INTEGER        DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "nProcessoSuspenso" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "vDescIncond"       NUMERIC(15,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "vDescCond"         NUMERIC(15,2)  DEFAULT 0;

-- ── 4. class_trib_ibs — 170 códigos NT 2025.002 v1.70 (Gap #10) ─────────────
CREATE TABLE IF NOT EXISTS class_trib_ibs (
  id          VARCHAR(36)   NOT NULL PRIMARY KEY,
  codigo      VARCHAR(6)    NOT NULL UNIQUE,
  cst         VARCHAR(3)    NOT NULL,
  descricao   VARCHAR(200)  NOT NULL,
  grupo       VARCHAR(50)   NOT NULL,
  "createdAt" TIMESTAMP     NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_class_trib_ibs_cst ON class_trib_ibs (cst);

COMMIT;

-- ── Verificação ───────────────────────────────────────────────────────────────
SELECT 'fiscal_brain_decisions.regime2027' AS campo,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='fiscal_brain_decisions' AND column_name='regime2027') AS ok
UNION ALL
SELECT 'nfe_det_pag', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='nfe_det_pag')
UNION ALL
SELECT 'nfe_documents.vTroco', EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='nfe_documents' AND column_name='vTroco')
UNION ALL
SELECT 'nfse_emitidas.cRegTrib', EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='nfse_emitidas' AND column_name='cRegTrib')
UNION ALL
SELECT 'class_trib_ibs', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='class_trib_ibs');
