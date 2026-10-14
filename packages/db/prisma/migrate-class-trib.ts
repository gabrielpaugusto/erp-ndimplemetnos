/**
 * Script de migração: converte cClassTrib do formato antigo (B0x) para o formato
 * oficial NT 2025.002 v1.70 (6 dígitos) e popula cstIbsCbs (3 dígitos).
 *
 * Execute após `prisma db push`:
 *   npx ts-node packages/db/prisma/migrate-class-trib.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapeamento do formato antigo para o novo (NT 2025.002 v1.70)
const MAPA_CTRIB: Record<string, { cClassTrib: string; cstIbsCbs: string }> = {
  'B00': { cClassTrib: '000001', cstIbsCbs: '000' }, // Tributado integral → CST 000
  'B01': { cClassTrib: '410001', cstIbsCbs: '410' }, // Imunidade         → CST 410
  'B02': { cClassTrib: '410002', cstIbsCbs: '410' }, // Não incidência    → CST 410
  'B03': { cClassTrib: '550001', cstIbsCbs: '550' }, // Suspensão         → CST 550
  'B05': { cClassTrib: '200001', cstIbsCbs: '200' }, // Alíquota zero     → CST 200 (reduzida)
  'B06': { cClassTrib: '400001', cstIbsCbs: '400' }, // Isenção           → CST 400
};

async function main() {
  console.log('🔄 Migrando cClassTrib para formato NT 2025.002 v1.70 (6 dígitos)...\n');

  let total = 0;

  for (const [antigo, novo] of Object.entries(MAPA_CTRIB)) {
    const resultado = await prisma.$executeRaw`
      UPDATE nfe_items
      SET c_class_trib = ${novo.cClassTrib},
          cst_ibs_cbs  = ${novo.cstIbsCbs}
      WHERE c_class_trib = ${antigo}
    `;
    if (resultado > 0) {
      console.log(`  ${antigo} → ${novo.cClassTrib} (CST ${novo.cstIbsCbs}): ${resultado} registros`);
      total += resultado;
    }
  }

  // Registros sem cClassTrib (null) → tributado padrão
  const nulos = await prisma.$executeRaw`
    UPDATE nfe_items
    SET c_class_trib = '000001',
        cst_ibs_cbs  = '000'
    WHERE c_class_trib IS NULL OR c_class_trib = ''
  `;
  if (nulos > 0) {
    console.log(`  NULL/vazio → 000001 (CST 000): ${nulos} registros`);
    total += nulos;
  }

  // Registros que já têm 6 dígitos mas sem cstIbsCbs → derivar os primeiros 3
  const semCst = await prisma.$executeRaw`
    UPDATE nfe_items
    SET cst_ibs_cbs = LEFT(c_class_trib, 3)
    WHERE LENGTH(c_class_trib) = 6 AND (cst_ibs_cbs IS NULL OR cst_ibs_cbs = '')
  `;
  if (semCst > 0) {
    console.log(`  Derivou cstIbsCbs de cClassTrib existente: ${semCst} registros`);
    total += semCst;
  }

  console.log(`\n✅ Total de registros atualizados: ${total}`);
}

main()
  .catch((e) => { console.error('❌ Erro:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
