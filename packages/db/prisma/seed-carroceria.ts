/**
 * Seed dedicado: TipoCarroceria + ModeloCarroceria
 * Executar: pnpm --filter @erp/db exec tsx prisma/seed-carroceria.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// TIPOS DE CARROCERIA — DENATRAN / CONTRAN (Res. 642/2016)
// codigoLegal = código oficial do tipo no licenciamento veicular
// ============================================================================
const TIPOS: {
  codigoLegal: string;
  nome: string;
  descricao: string;
  ordem: number;
}[] = [
  { codigoLegal: 'BA',  nome: 'Baú',                descricao: 'Carroceria fechada, paredes rígidas — carga seca geral',                         ordem: 1  },
  { codigoLegal: 'BS',  nome: 'Basculante',          descricao: 'Carroceria com sistema hidráulico de tombamento — granéis sólidos e entulhos',   ordem: 2  },
  { codigoLegal: 'GR',  nome: 'Graneleiro',          descricao: 'Carroceria aberta com laterais altas e escotilhas — grãos e granéis secos',      ordem: 3  },
  { codigoLegal: 'TQ',  nome: 'Tanque',              descricao: 'Cisterna cilíndrica — líquidos, gases e produtos químicos',                      ordem: 4  },
  { codigoLegal: 'FR',  nome: 'Frigorífico',         descricao: 'Baú isotérmico com refrigeração — cargas perecíveis e frios',                    ordem: 5  },
  { codigoLegal: 'PL',  nome: 'Plataforma',          descricao: 'Carroceria plana sem laterais — máquinas, contêineres e cargas especiais',        ordem: 6  },
  { codigoLegal: 'SD',  nome: 'Sider',               descricao: 'Baú com lonas laterais corredias — agilidade na carga/descarga lateral',         ordem: 7  },
  { codigoLegal: 'CG',  nome: 'Cegonheira',          descricao: 'Plataforma com pisos escamoteáveis — transporte de veículos automotores',         ordem: 8  },
  { codigoLegal: 'PC',  nome: 'Porta-Contêiner',     descricao: 'Chassi com twistlocks — transporte de contêineres ISO 20/40 pés',               ordem: 9  },
  { codigoLegal: 'FL',  nome: 'Florestal',           descricao: 'Estrutura com bolsões ou tombadores — transporte de toras e eucalipto',          ordem: 10 },
  { codigoLegal: 'PR',  nome: 'Prancha',             descricao: 'Plataforma rebaixada extensível — equipamentos pesados e cargas especiais',       ordem: 11 },
  { codigoLegal: 'BC',  nome: 'Boiadeiro',           descricao: 'Carroceria com gaiola ventilada — transporte de animais vivos',                  ordem: 12 },
  { codigoLegal: 'MX',  nome: 'Misto/Aberto',        descricao: 'Carroceria aberta com grades — uso geral e agrícola',                            ordem: 13 },
  { codigoLegal: 'LX',  nome: 'Lixeira/Compactador', descricao: 'Carroceria com sistema de compactação — coleta de resíduos sólidos urbanos',     ordem: 14 },
  { codigoLegal: 'CM',  nome: 'Cimento/Betoneira',   descricao: 'Tambor giratório — transporte e mistura de concreto',                            ordem: 15 },
];

// ============================================================================
// MODELOS — agrupados por tipoCodigoLegal
// ============================================================================
const MODELOS: {
  tipoCodigoLegal: string;
  nome: string;
  fabricante?: string;
  descricao?: string;
}[] = [
  // ── Baú ──────────────────────────────────────────────────────────────────
  { tipoCodigoLegal: 'BA', nome: 'Baú Standard 14,5m',             fabricante: 'ND Implementos', descricao: 'Baú seco padrão de mercado — 14,5m úteis' },
  { tipoCodigoLegal: 'BA', nome: 'Baú Standard 13,6m',             fabricante: 'ND Implementos', descricao: 'Baú seco 13,6m — semi-reboque trucado' },
  { tipoCodigoLegal: 'BA', nome: 'Baú Reforçado 14,5m',            fabricante: 'ND Implementos', descricao: 'Baú com reforço de assoalho — carga pesada' },
  { tipoCodigoLegal: 'BA', nome: 'Baú Graneleiro Combinado',        fabricante: 'ND Implementos', descricao: 'Baú com escotilha superior — carga seca + granel' },

  // ── Basculante ────────────────────────────────────────────────────────────
  { tipoCodigoLegal: 'BS', nome: 'Basculante Traseiro 10m³',        fabricante: 'ND Implementos', descricao: 'Basculante traseiro — caminhão toco/truck' },
  { tipoCodigoLegal: 'BS', nome: 'Basculante Traseiro 15m³',        fabricante: 'ND Implementos', descricao: 'Basculante traseiro — bitruck e rodotrem' },
  { tipoCodigoLegal: 'BS', nome: 'Basculante Lateral',              fabricante: 'ND Implementos', descricao: 'Tombamento lateral hidráulico — granéis e mineração' },
  { tipoCodigoLegal: 'BS', nome: 'Basculante Triângulo',            fabricante: 'ND Implementos', descricao: 'Estrutura em treliça triangular — alta resistência' },

  // ── Graneleiro ───────────────────────────────────────────────────────────
  { tipoCodigoLegal: 'GR', nome: 'Graneleiro 3 Eixos 92m³',         fabricante: 'ND Implementos', descricao: 'Semi-reboque graneleiro 3 eixos — soja, milho, trigo' },
  { tipoCodigoLegal: 'GR', nome: 'Graneleiro 2 Eixos 72m³',         fabricante: 'ND Implementos', descricao: 'Semi-reboque graneleiro 2 eixos — grãos regionais' },
  { tipoCodigoLegal: 'GR', nome: 'Graneleiro Rodotrem 137m³',        fabricante: 'ND Implementos', descricao: 'Rodotrem graneleiro com eixo direcional' },

  // ── Tanque ───────────────────────────────────────────────────────────────
  { tipoCodigoLegal: 'TQ', nome: 'Tanque Combustível 30.000L',       fabricante: 'ND Implementos', descricao: 'Cisterna para gasolina, diesel e etanol — aço carbono' },
  { tipoCodigoLegal: 'TQ', nome: 'Tanque Alimentar 20.000L',         fabricante: 'ND Implementos', descricao: 'Cisterna inox AISI 304 — leite e líquidos alimentares' },
  { tipoCodigoLegal: 'TQ', nome: 'Tanque Químico 25.000L',           fabricante: 'ND Implementos', descricao: 'Cisterna em aço inox ou PRFV — produtos químicos' },

  // ── Frigorífico ───────────────────────────────────────────────────────────
  { tipoCodigoLegal: 'FR', nome: 'Baú Frigorífico 14,5m',            fabricante: 'ND Implementos', descricao: 'Baú com unidade de refrigeração Carrier/Thermo King' },
  { tipoCodigoLegal: 'FR', nome: 'Baú Frigorífico 13,6m',            fabricante: 'ND Implementos', descricao: 'Baú frigorífico trucado — carnes e laticínios' },
  { tipoCodigoLegal: 'FR', nome: 'Baú Isotérmico (sem motor)',        fabricante: 'ND Implementos', descricao: 'Baú apenas com isolamento térmico — gelo seco/dry ice' },

  // ── Plataforma ───────────────────────────────────────────────────────────
  { tipoCodigoLegal: 'PL', nome: 'Plataforma 3 Eixos',               fabricante: 'ND Implementos', descricao: 'Plataforma fixa — contêineres, máquinas e bobinas' },
  { tipoCodigoLegal: 'PL', nome: 'Plataforma Extensível',            fabricante: 'ND Implementos', descricao: 'Plataforma com extensão traseira — cargas longas' },

  // ── Sider ────────────────────────────────────────────────────────────────
  { tipoCodigoLegal: 'SD', nome: 'Sider 3 Eixos 14,5m',              fabricante: 'ND Implementos', descricao: 'Sider lona lateral corrediça — paletes e caixas' },
  { tipoCodigoLegal: 'SD', nome: 'Sider 2 Eixos 13,6m',              fabricante: 'ND Implementos', descricao: 'Sider trucado — distribuição e logística urbana' },

  // ── Cegonheira ───────────────────────────────────────────────────────────
  { tipoCodigoLegal: 'CG', nome: 'Cegonheira 9 Carros',              fabricante: 'ND Implementos', descricao: 'Semi-reboque cegonheira 9 veículos — automóveis' },
  { tipoCodigoLegal: 'CG', nome: 'Cegonheira 7 Carros',              fabricante: 'ND Implementos', descricao: 'Cegonheira 7 veículos com rampa rebaixada' },

  // ── Porta-Contêiner ──────────────────────────────────────────────────────
  { tipoCodigoLegal: 'PC', nome: 'Porta-Contêiner 20/40 pés',        fabricante: 'ND Implementos', descricao: 'Chassi com twistlocks — ISO 20 e 40 pés' },
  { tipoCodigoLegal: 'PC', nome: 'Porta-Contêiner Tanque',           fabricante: 'ND Implementos', descricao: 'Chassi reforçado — contêiner tanque ISO' },

  // ── Florestal ────────────────────────────────────────────────────────────
  { tipoCodigoLegal: 'FL', nome: 'Florestal Tombador 3 Eixos',       fabricante: 'ND Implementos', descricao: 'Semi-reboque florestal com tombamento lateral' },
  { tipoCodigoLegal: 'FL', nome: 'Florestal Gaiola 3 Eixos',         fabricante: 'ND Implementos', descricao: 'Florestal com bolsões fixos — pinus e pinheiro' },

  // ── Prancha ──────────────────────────────────────────────────────────────
  { tipoCodigoLegal: 'PR', nome: 'Prancha Baixa 3+2 Eixos',          fabricante: 'ND Implementos', descricao: 'Plataforma rebaixada — escavadeiras e tratores' },
  { tipoCodigoLegal: 'PR', nome: 'Prancha Extensível',               fabricante: 'ND Implementos', descricao: 'Prancha com extensão — vigas e cargas especiais' },

  // ── Boiadeiro ─────────────────────────────────────────────────────────────
  { tipoCodigoLegal: 'BC', nome: 'Boiadeiro 3 Eixos',                fabricante: 'ND Implementos', descricao: 'Gaiola 3 eixos — bovinos e suínos' },
  { tipoCodigoLegal: 'BC', nome: 'Boiadeiro Duplo Piso',             fabricante: 'ND Implementos', descricao: 'Gaiola com piso intermediário — suínos e ovinos' },
];

async function main() {
  console.log('🌱 Seed: TipoCarroceria + ModeloCarroceria...\n');

  // ── Upsert tipos ────────────────────────────────────────────────────────
  const tipoMap: Record<string, string> = {};

  for (const tipo of TIPOS) {
    const record = await prisma.tipoCarroceria.upsert({
      where: { codigoLegal: tipo.codigoLegal },
      update: { nome: tipo.nome, descricao: tipo.descricao, ordem: tipo.ordem },
      create: { ...tipo, ativo: true },
    });
    tipoMap[tipo.codigoLegal] = record.id;
    console.log(`  ✔ ${tipo.codigoLegal} — ${tipo.nome}`);
  }
  console.log(`\n✅ ${TIPOS.length} tipos de carroceria inseridos/atualizados\n`);

  // ── Upsert modelos ──────────────────────────────────────────────────────
  let ok = 0;
  let skip = 0;

  for (const modelo of MODELOS) {
    const tipoId = tipoMap[modelo.tipoCodigoLegal];
    if (!tipoId) { skip++; continue; }

    const existing = await prisma.modeloCarroceria.findFirst({
      where: { tipoCarroceriaId: tipoId, nome: modelo.nome },
    });

    if (existing) {
      await prisma.modeloCarroceria.update({
        where: { id: existing.id },
        data: { fabricante: modelo.fabricante, descricao: modelo.descricao },
      });
    } else {
      await prisma.modeloCarroceria.create({
        data: {
          tipoCarroceriaId: tipoId,
          nome: modelo.nome,
          fabricante: modelo.fabricante,
          descricao: modelo.descricao,
          ativo: true,
        },
      });
    }
    ok++;
  }

  console.log(`✅ ${ok} modelos de carroceria inseridos/atualizados`);
  if (skip > 0) console.log(`⚠️  ${skip} modelos ignorados (tipo não encontrado)`);
  console.log('\n🎉 Seed de carroceria concluído!');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
