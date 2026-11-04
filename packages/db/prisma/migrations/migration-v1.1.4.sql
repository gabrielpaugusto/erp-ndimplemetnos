-- ============================================================
-- Migration v1.1.3 → v1.1.4
-- Auditoria ERP: Float→Decimal NF-e, índices multi-tenant, seed plano de contas
-- Executar em: erp-postgres-prod (banco de produção)
-- Comando: docker exec erp-postgres-prod psql -U erp_prod_user -d erp_prod -f /tmp/migration-v1.1.4.sql
-- ============================================================

BEGIN;

-- ── 1. Float → Decimal em nfe_documents ──────────────────────────────────────
-- NOTA: DOUBLE PRECISION → NUMERIC requer cast explícito no PostgreSQL.
-- Os valores são preservados com arredondamento para 2 casas decimais.

ALTER TABLE nfe_documents
  ALTER COLUMN "valorProdutos"     TYPE NUMERIC(15,2) USING "valorProdutos"::NUMERIC(15,2),
  ALTER COLUMN "valorFrete"        TYPE NUMERIC(15,2) USING "valorFrete"::NUMERIC(15,2),
  ALTER COLUMN "valorSeguro"       TYPE NUMERIC(15,2) USING "valorSeguro"::NUMERIC(15,2),
  ALTER COLUMN "valorDesconto"     TYPE NUMERIC(15,2) USING "valorDesconto"::NUMERIC(15,2),
  ALTER COLUMN "valorOutros"       TYPE NUMERIC(15,2) USING "valorOutros"::NUMERIC(15,2),
  ALTER COLUMN "valorTotal"        TYPE NUMERIC(15,2) USING "valorTotal"::NUMERIC(15,2),
  ALTER COLUMN "valorIcms"         TYPE NUMERIC(15,2) USING "valorIcms"::NUMERIC(15,2),
  ALTER COLUMN "valorIcmsSt"       TYPE NUMERIC(15,2) USING "valorIcmsSt"::NUMERIC(15,2),
  ALTER COLUMN "valorIpi"          TYPE NUMERIC(15,2) USING "valorIpi"::NUMERIC(15,2),
  ALTER COLUMN "valorPis"          TYPE NUMERIC(15,2) USING "valorPis"::NUMERIC(15,2),
  ALTER COLUMN "valorCofins"       TYPE NUMERIC(15,2) USING "valorCofins"::NUMERIC(15,2),
  ALTER COLUMN "valorIbs"          TYPE NUMERIC(15,2) USING "valorIbs"::NUMERIC(15,2),
  ALTER COLUMN "valorCbs"          TYPE NUMERIC(15,2) USING "valorCbs"::NUMERIC(15,2),
  ALTER COLUMN "valorIs"           TYPE NUMERIC(15,2) USING "valorIs"::NUMERIC(15,2),
  ALTER COLUMN "valorDifal"        TYPE NUMERIC(15,2) USING "valorDifal"::NUMERIC(15,2),
  ALTER COLUMN "valorDifalDestino" TYPE NUMERIC(15,2) USING "valorDifalDestino"::NUMERIC(15,2),
  ALTER COLUMN "valorDifalOrigem"  TYPE NUMERIC(15,2) USING "valorDifalOrigem"::NUMERIC(15,2),
  ALTER COLUMN "valorFcp"          TYPE NUMERIC(15,2) USING "valorFcp"::NUMERIC(15,2),
  ALTER COLUMN "aliqInterestadual" TYPE NUMERIC(8,4)  USING "aliqInterestadual"::NUMERIC(8,4),
  ALTER COLUMN "aliqInternaDestino" TYPE NUMERIC(8,4) USING "aliqInternaDestino"::NUMERIC(8,4),
  ALTER COLUMN "vTroco"            TYPE NUMERIC(15,2) USING "vTroco"::NUMERIC(15,2);

-- ── 2. Float → Decimal em nfe_items ──────────────────────────────────────────

ALTER TABLE nfe_items
  ALTER COLUMN quantity        TYPE NUMERIC(15,4) USING quantity::NUMERIC(15,4),
  ALTER COLUMN "unitPrice"     TYPE NUMERIC(15,4) USING "unitPrice"::NUMERIC(15,4),
  ALTER COLUMN "totalPrice"    TYPE NUMERIC(15,2) USING "totalPrice"::NUMERIC(15,2),
  ALTER COLUMN "bcIcms"        TYPE NUMERIC(15,2) USING "bcIcms"::NUMERIC(15,2),
  ALTER COLUMN "aliqIcms"      TYPE NUMERIC(8,4)  USING "aliqIcms"::NUMERIC(8,4),
  ALTER COLUMN "valorIcms"     TYPE NUMERIC(15,2) USING "valorIcms"::NUMERIC(15,2),
  ALTER COLUMN "bcIcmsSt"      TYPE NUMERIC(15,2) USING "bcIcmsSt"::NUMERIC(15,2),
  ALTER COLUMN "aliqIcmsSt"    TYPE NUMERIC(8,4)  USING "aliqIcmsSt"::NUMERIC(8,4),
  ALTER COLUMN "valorIcmsSt"   TYPE NUMERIC(15,2) USING "valorIcmsSt"::NUMERIC(15,2),
  ALTER COLUMN "bcIpi"         TYPE NUMERIC(15,2) USING "bcIpi"::NUMERIC(15,2),
  ALTER COLUMN "aliqIpi"       TYPE NUMERIC(8,4)  USING "aliqIpi"::NUMERIC(8,4),
  ALTER COLUMN "valorIpi"      TYPE NUMERIC(15,2) USING "valorIpi"::NUMERIC(15,2),
  ALTER COLUMN "bcPis"         TYPE NUMERIC(15,2) USING "bcPis"::NUMERIC(15,2),
  ALTER COLUMN "aliqPis"       TYPE NUMERIC(8,4)  USING "aliqPis"::NUMERIC(8,4),
  ALTER COLUMN "valorPis"      TYPE NUMERIC(15,2) USING "valorPis"::NUMERIC(15,2),
  ALTER COLUMN "bcCofins"      TYPE NUMERIC(15,2) USING "bcCofins"::NUMERIC(15,2),
  ALTER COLUMN "aliqCofins"    TYPE NUMERIC(8,4)  USING "aliqCofins"::NUMERIC(8,4),
  ALTER COLUMN "valorCofins"   TYPE NUMERIC(15,2) USING "valorCofins"::NUMERIC(15,2),
  ALTER COLUMN "bcIbs"         TYPE NUMERIC(15,2) USING "bcIbs"::NUMERIC(15,2),
  ALTER COLUMN "aliqIbs"       TYPE NUMERIC(8,4)  USING "aliqIbs"::NUMERIC(8,4),
  ALTER COLUMN "valorIbs"      TYPE NUMERIC(15,2) USING "valorIbs"::NUMERIC(15,2),
  ALTER COLUMN "aliqIbsUf"     TYPE NUMERIC(8,4)  USING "aliqIbsUf"::NUMERIC(8,4),
  ALTER COLUMN "valorIbsUf"    TYPE NUMERIC(15,2) USING "valorIbsUf"::NUMERIC(15,2),
  ALTER COLUMN "aliqIbsMun"    TYPE NUMERIC(8,4)  USING "aliqIbsMun"::NUMERIC(8,4),
  ALTER COLUMN "valorIbsMun"   TYPE NUMERIC(15,2) USING "valorIbsMun"::NUMERIC(15,2),
  ALTER COLUMN "bcCbs"         TYPE NUMERIC(15,2) USING "bcCbs"::NUMERIC(15,2),
  ALTER COLUMN "aliqCbs"       TYPE NUMERIC(8,4)  USING "aliqCbs"::NUMERIC(8,4),
  ALTER COLUMN "valorCbs"      TYPE NUMERIC(15,2) USING "valorCbs"::NUMERIC(15,2),
  ALTER COLUMN "bcIs"          TYPE NUMERIC(15,2) USING "bcIs"::NUMERIC(15,2),
  ALTER COLUMN "aliqIs"        TYPE NUMERIC(8,4)  USING "aliqIs"::NUMERIC(8,4),
  ALTER COLUMN "valorIs"       TYPE NUMERIC(15,2) USING "valorIs"::NUMERIC(15,2);

-- ── 3. Float → Decimal em fiscal_apuracoes ────────────────────────────────────

ALTER TABLE fiscal_apuracoes
  ALTER COLUMN "totalDebitos"   TYPE NUMERIC(15,2) USING "totalDebitos"::NUMERIC(15,2),
  ALTER COLUMN "totalCreditos"  TYPE NUMERIC(15,2) USING "totalCreditos"::NUMERIC(15,2),
  ALTER COLUMN "saldoAnterior"  TYPE NUMERIC(15,2) USING "saldoAnterior"::NUMERIC(15,2),
  ALTER COLUMN "deducoesLegais" TYPE NUMERIC(15,2) USING "deducoesLegais"::NUMERIC(15,2),
  ALTER COLUMN "ajustesDebito"  TYPE NUMERIC(15,2) USING "ajustesDebito"::NUMERIC(15,2),
  ALTER COLUMN "ajustesCredito" TYPE NUMERIC(15,2) USING "ajustesCredito"::NUMERIC(15,2),
  ALTER COLUMN "impostoAPagar"  TYPE NUMERIC(15,2) USING "impostoAPagar"::NUMERIC(15,2),
  ALTER COLUMN "saldoCredor"    TYPE NUMERIC(15,2) USING "saldoCredor"::NUMERIC(15,2);

-- ── 4. Índices multi-tenant por companyId + status ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_quotations_company_status
  ON quotations ("companyId", status);

CREATE INDEX IF NOT EXISTS idx_production_orders_company_status
  ON production_orders ("companyId", status);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_company_status
  ON purchase_orders ("companyId", status);

CREATE INDEX IF NOT EXISTS idx_nfse_emitidas_company_status
  ON nfse_emitidas ("companyId", status);

CREATE INDEX IF NOT EXISTS idx_nfse_recebidas_company_status
  ON nfse_recebidas ("companyId", status);

CREATE INDEX IF NOT EXISTS idx_sale_orders_company_status
  ON sale_orders ("companyId", status);

CREATE INDEX IF NOT EXISTS idx_journal_entries_company_status
  ON journal_entries ("companyId", status);

-- ── 5. FK ON DELETE SET NULL — relações opcionais com User ───────────────────
-- Remove e recria as 21 FKs opcionais de User com SET NULL para evitar erros
-- ao deletar usuários que tenham registros vinculados por campos anuláveis.

DO $$
DECLARE
  r RECORD;
  col_name TEXT;
  col_nullable TEXT;
BEGIN
  FOR r IN
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.table_constraints tc2
      ON rc.unique_constraint_name = tc2.constraint_name
    WHERE tc2.table_name = 'users'
      AND rc.delete_rule = 'NO ACTION'
      AND tc.constraint_type = 'FOREIGN KEY'
  LOOP
    SELECT kcu.column_name INTO col_name
    FROM information_schema.key_column_usage kcu
    WHERE kcu.constraint_name = r.constraint_name
      AND kcu.table_name = r.table_name
    LIMIT 1;

    SELECT c.is_nullable INTO col_nullable
    FROM information_schema.columns c
    WHERE c.table_name = r.table_name AND c.column_name = col_name;

    IF col_nullable = 'YES' THEN
      EXECUTE format(
        'ALTER TABLE %I DROP CONSTRAINT %I',
        r.table_name, r.constraint_name
      );
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) ON DELETE SET NULL',
        r.table_name, r.constraint_name, col_name
      );
    END IF;
  END LOOP;
END;
$$;

-- ── 6. Soft-delete — adiciona coluna deletedAt aos modelos críticos ──────────
ALTER TABLE sale_orders       ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE quotations        ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE purchase_orders   ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- MinIO backup key para NF-e XML
ALTER TABLE nfe_documents ADD COLUMN IF NOT EXISTS "xmlBackupKey" VARCHAR(200);

-- ── 7. Novo valor no enum NFeStatus para transmissão assíncrona ───────────────
-- ALTER TYPE ... ADD VALUE não pode rodar dentro de uma transação em versões
-- antigas do PostgreSQL. Executar fora do BEGIN/COMMIT quando necessário.
-- No PostgreSQL 12+ é seguro dentro de transação com IF NOT EXISTS.
ALTER TYPE "NFeStatus" ADD VALUE IF NOT EXISTS 'AGUARDANDO_TRANSMISSAO' BEFORE 'TRANSMITIDA';

COMMIT;
