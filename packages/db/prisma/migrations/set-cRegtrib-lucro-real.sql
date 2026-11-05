-- Atualiza cRegTribIBSCBS para 4 (Lucro Real) em todas as empresas
-- com taxRegime LUCRO_REAL que ainda estão com o valor padrão 3.
--
-- NT 2025.002 — LC 214/2025: campo obrigatório na NF-e para LR/LP
-- desde 03/08/2026. Valor 4 = Lucro Real.
--
-- Executar em homologação e produção antes do primeiro envio de NF-e.

UPDATE companies
SET "cRegTribIBSCBS" = 4
WHERE "taxRegime" = 'LUCRO_REAL'
  AND "cRegTribIBSCBS" <> 4;

-- Verificação:
SELECT id, "razaoSocial", "taxRegime", "cRegTribIBSCBS"
FROM companies
WHERE "taxRegime" = 'LUCRO_REAL';
