import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

export interface LegislacaoContext {
  trechos: { numero: string; artigo: string | null; assunto: string; texto: string }[];
}

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca trechos de legislação relevantes para classificar uma operação.
   * Filtra por UF (inclui federal), tipo de operação e NCMs informados.
   */
  async buscar(params: {
    ufEmitente: string;
    ufDestinatario: string;
    ncms: string[];
    palavrasChave: string[];
  }): Promise<LegislacaoContext> {
    const { ufEmitente, ufDestinatario, ncms, palavrasChave } = params;
    const ufs = [...new Set([ufEmitente, ufDestinatario, null])];

    const termos = [
      ...palavrasChave,
      ...ncms.map((n) => n.slice(0, 4)), // capítulo NCM
    ].filter(Boolean);

    try {
      const items = await this.prisma.legislacaoItem.findMany({
        where: {
          ativo: true,
          vigenciaFim: null,
          OR: [
            { uf: null },
            { uf: { in: [ufEmitente, ufDestinatario] } },
          ],
        },
        select: { numero: true, artigo: true, assunto: true, texto: true },
        take: 40,
      });

      // Prioriza itens cujo assunto contém palavras-chave
      const scored = items
        .map((item) => {
          const haystack = (item.assunto + ' ' + item.texto).toLowerCase();
          const score = termos.reduce(
            (acc, t) => acc + (haystack.includes(t.toLowerCase()) ? 1 : 0),
            0,
          );
          return { item, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 12) // top 12 mais relevantes
        .map(({ item }) => item);

      return { trechos: scored };
    } catch (e) {
      this.logger.warn(`KnowledgeBase.buscar falhou: ${e?.message}`);
      return { trechos: [] };
    }
  }

  /** Retorna a contagem de itens da base — útil para monitorar se está populada. */
  async count(): Promise<number> {
    try {
      return await this.prisma.legislacaoItem.count({ where: { ativo: true } });
    } catch {
      return 0;
    }
  }

  /**
   * Seed inicial da base de conhecimento com as principais regras fiscais brasileiras.
   * Idempotente — não duplica registros existentes pelo campo `numero+artigo`.
   */
  async seedLegislacaoBase(): Promise<{ criados: number; ignorados: number }> {
    const items = BASE_LEGISLACAO;
    let criados = 0;
    let ignorados = 0;

    for (const item of items) {
      const existe = await this.prisma.legislacaoItem.findFirst({
        where: { numero: item.numero, artigo: item.artigo ?? null },
      });
      if (existe) { ignorados++; continue; }
      await this.prisma.legislacaoItem.create({ data: item });
      criados++;
    }
    return { criados, ignorados };
  }
}

// ─── Base de conhecimento inicial ─────────────────────────────────────────────
const BASE_LEGISLACAO = [
  // ── CFOP — Quadro geral ──────────────────────────────────────────────────
  {
    tipo: 'CFOP', uf: null,
    numero: 'Ajuste SINIEF 07/2001 - Tabela CFOP',
    artigo: '1.101/2.101/3.101',
    assunto: 'CFOP compra para industrialização insumo matéria-prima',
    texto: '1.101: Compra para industrialização ou produção rural — entradas de mercadorias que serão utilizadas em processo de industrialização. 2.101: mesma operação com fornecedor de outra UF. 3.101: importação para industrialização.',
    vigenciaInicio: new Date('2001-01-01'),
  },
  {
    tipo: 'CFOP', uf: null,
    numero: 'Ajuste SINIEF 07/2001 - Tabela CFOP',
    artigo: '1.102/2.102/3.102',
    assunto: 'CFOP compra para comercialização revenda',
    texto: '1.102: Compra para comercialização — entradas de mercadorias que serão objeto de saída para comercialização. 2.102: mesma operação com fornecedor de outra UF. 3.102: importação para comercialização.',
    vigenciaInicio: new Date('2001-01-01'),
  },
  {
    tipo: 'CFOP', uf: null,
    numero: 'Ajuste SINIEF 07/2001 - Tabela CFOP',
    artigo: '5.101/6.101',
    assunto: 'CFOP venda produto industrialização fabricação própria saída',
    texto: '5.101: Venda de produção do estabelecimento — saída por venda de produto fabricado pelo próprio estabelecimento. 6.101: mesma operação para outra UF (venda interestadual de produção própria).',
    vigenciaInicio: new Date('2001-01-01'),
  },
  {
    tipo: 'CFOP', uf: null,
    numero: 'Ajuste SINIEF 07/2001 - Tabela CFOP',
    artigo: '5.102/6.102',
    assunto: 'CFOP venda mercadoria adquirida ou recebida de terceiros comercialização',
    texto: '5.102: Venda de mercadoria adquirida ou recebida de terceiros — saída por venda de mercadoria recebida para comercialização. 6.102: mesma operação interestadual.',
    vigenciaInicio: new Date('2001-01-01'),
  },
  {
    tipo: 'CFOP', uf: null,
    numero: 'Ajuste SINIEF 07/2001 - Tabela CFOP',
    artigo: '5.401/6.401',
    assunto: 'CFOP venda produto industrialização substituição tributária ST',
    texto: '5.401: Venda de produção do estabelecimento em operação com produto sujeito ao regime de substituição tributária na condição de contribuinte substituto. 6.401: mesma operação interestadual.',
    vigenciaInicio: new Date('2001-01-01'),
  },
  {
    tipo: 'CFOP', uf: null,
    numero: 'Ajuste SINIEF 07/2001 - Tabela CFOP',
    artigo: '5.405',
    assunto: 'CFOP venda mercadoria substituição tributária ST já recolhida',
    texto: '5.405: Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária, na condição de contribuinte substituído. ICMS-ST já recolhido anteriormente.',
    vigenciaInicio: new Date('2001-01-01'),
  },
  {
    tipo: 'CFOP', uf: null,
    numero: 'Ajuste SINIEF 07/2001 - Tabela CFOP',
    artigo: '5.910/6.910',
    assunto: 'CFOP remessa em bonificação doação brinde',
    texto: '5.910: Remessa em bonificação, doação ou brinde — saída de mercadoria a título de bonificação, doação ou brinde. 6.910: mesma operação interestadual.',
    vigenciaInicio: new Date('2001-01-01'),
  },
  {
    tipo: 'CFOP', uf: null,
    numero: 'Ajuste SINIEF 07/2001 - Tabela CFOP',
    artigo: '5.201/6.201',
    assunto: 'CFOP devolução de compra industrialização',
    texto: '5.201: Devolução de compra para industrialização ou produção rural — devolução de mercadoria comprada para industrialização. 6.201: mesma operação para outra UF.',
    vigenciaInicio: new Date('2001-01-01'),
  },
  {
    tipo: 'CFOP', uf: null,
    numero: 'Ajuste SINIEF 07/2001 - Tabela CFOP',
    artigo: '1.201/2.201',
    assunto: 'CFOP devolução de venda de produção própria entrada',
    texto: '1.201: Devolução de venda de produção do estabelecimento — entrada por devolução de produto fabricado pelo próprio estabelecimento. 2.201: mesma operação de outra UF.',
    vigenciaInicio: new Date('2001-01-01'),
  },
  // ── ICMS Interestadual — Alíquotas ──────────────────────────────────────
  {
    tipo: 'RICMS', uf: null,
    numero: 'Resolução Senado Federal 22/1989',
    artigo: 'Art. 1º',
    assunto: 'ICMS alíquota interestadual produto industrializado importado',
    texto: 'Art. 1º A alíquota do Imposto sobre Operações Relativas à Circulação de Mercadorias e sobre Prestações de Serviços de Transporte Interestadual e Intermunicipal e de Comunicação (ICMS), nas operações e prestações interestaduais, será de doze por cento (12%). Exceção: operações para as Regiões Norte, Nordeste e Centro-Oeste e para o Estado do Espírito Santo — alíquota de 7%.',
    vigenciaInicio: new Date('1989-01-01'),
  },
  {
    tipo: 'RICMS', uf: null,
    numero: 'Resolução Senado Federal 13/2012',
    artigo: 'Art. 1º',
    assunto: 'ICMS alíquota interestadual importado conteúdo de importação',
    texto: 'Art. 1º A alíquota do ICMS nas operações interestaduais com bens e mercadorias importados do exterior será de quatro por cento (4%), independentemente de qual Estado importou. Aplica-se quando o produto tem conteúdo de importação superior a 40% ou não foi submetido a processo de industrialização no Brasil.',
    vigenciaInicio: new Date('2013-01-01'),
  },
  // ── CST-ICMS ─────────────────────────────────────────────────────────────
  {
    tipo: 'CST', uf: null,
    numero: 'Tabela A + B — CST ICMS',
    artigo: '00/10/20/30/40/41/50/51/60/70/90',
    assunto: 'CST ICMS código situação tributária tributado isento imune suspensão',
    texto: `CST 00: Tributada integralmente.
CST 10: Tributada e com cobrança do ICMS por ST.
CST 20: Com redução de base de cálculo.
CST 30: Isenta ou não tributada e com cobrança do ICMS por ST.
CST 40: Isenta.
CST 41: Não tributada.
CST 50: Suspensão.
CST 51: Diferimento.
CST 60: ICMS cobrado anteriormente por ST.
CST 70: Com redução de base de cálculo e cobrança de ICMS por ST.
CST 90: Outros.`,
    vigenciaInicio: new Date('2001-01-01'),
  },
  // ── CSOSN (Simples Nacional) ──────────────────────────────────────────────
  {
    tipo: 'CST', uf: null,
    numero: 'Tabela B — CSOSN Simples Nacional',
    artigo: '101/102/103/201/202/203/300/400/500/900',
    assunto: 'CSOSN Simples Nacional código situação operação simples',
    texto: `CSOSN 101: Tributada pelo Simples Nacional com permissão de crédito.
CSOSN 102: Tributada pelo Simples Nacional sem permissão de crédito.
CSOSN 103: Isenção do ICMS no Simples Nacional para faixa de receita bruta.
CSOSN 201: Tributada pelo Simples Nacional com permissão de crédito e com cobrança do ICMS por ST.
CSOSN 202: Tributada pelo Simples Nacional sem permissão de crédito e com cobrança do ICMS por ST.
CSOSN 203: Isenção do ICMS no Simples Nacional para faixa de receita bruta e com cobrança do ICMS por ST.
CSOSN 300: Imune.
CSOSN 400: Não tributada pelo Simples Nacional.
CSOSN 500: ICMS cobrado anteriormente por ST ou por antecipação.
CSOSN 900: Outros.`,
    vigenciaInicio: new Date('2009-01-01'),
  },
  // ── CST PIS/COFINS ────────────────────────────────────────────────────────
  {
    tipo: 'CST', uf: null,
    numero: 'Instrução Normativa SRF 247/2002 - Tabela CST PIS/COFINS',
    artigo: '01/02/03/04/05/06/07/08/09/49/50/70/73/99',
    assunto: 'CST PIS COFINS código situação tributária tributado não cumulativo',
    texto: `CST 01: Operação Tributável com Alíquota Básica (1,65% PIS / 7,6% COFINS — não-cumulativo).
CST 02: Operação Tributável com Alíquota Diferenciada.
CST 03: Operação Tributável com Alíquota por Unidade de Medida de Produto.
CST 04: Operação Tributável Monofásica - Revenda a Alíquota Zero.
CST 05: Operação Tributável por ST.
CST 06: Operação Tributável a Alíquota Zero.
CST 07: Operação Isenta da Contribuição.
CST 08: Operação sem Incidência da Contribuição.
CST 09: Operação com Suspensão da Contribuição.
CST 49: Outras Operações de Saída.
CST 50: Operação com Direito a Crédito — Vinculada Exclusivamente a Receita Tributada (0,65% PIS / 3% COFINS — cumulativo; 1,65%/7,6% não-cumulativo).
CST 70: Operação de Aquisição sem Direito a Crédito.
CST 73: Operação de Aquisição a Alíquota Zero.
CST 99: Outras Operações de Entrada.`,
    vigenciaInicio: new Date('2002-01-01'),
  },
  // ── PIS/COFINS — Regime não-cumulativo ────────────────────────────────────
  {
    tipo: 'IN_RFB', uf: null,
    numero: 'Lei 10.637/2002 e Lei 10.833/2003',
    artigo: 'Art. 2º / Art. 3º',
    assunto: 'PIS COFINS alíquota não cumulativo lucro real',
    texto: 'PIS não-cumulativo: alíquota 1,65%. COFINS não-cumulativa: alíquota 7,6%. Aplicável a pessoas jurídicas tributadas pelo Lucro Real. Permite créditos sobre insumos, energia elétrica, aluguéis, depreciação de bens do ativo imobilizado usados na produção.',
    vigenciaInicio: new Date('2003-02-01'),
  },
  {
    tipo: 'IN_RFB', uf: null,
    numero: 'Lei 9.718/1998',
    artigo: 'Art. 3º',
    assunto: 'PIS COFINS alíquota cumulativo lucro presumido simples',
    texto: 'PIS cumulativo: alíquota 0,65%. COFINS cumulativa: alíquota 3,0%. Aplicável a pessoas jurídicas tributadas pelo Lucro Presumido ou Simples Nacional. Não gera créditos.',
    vigenciaInicio: new Date('1999-01-01'),
  },
  // ── IPI ───────────────────────────────────────────────────────────────────
  {
    tipo: 'RIPI', uf: null,
    numero: 'Decreto 7.212/2010 — RIPI',
    artigo: 'Art. 4º / Art. 35',
    assunto: 'IPI fato gerador estabelecimento industrial produto industrializado',
    texto: 'IPI incide sobre produtos industrializados. Fato gerador: saída do estabelecimento industrial ou equiparado. Contribuinte: estabelecimento industrial ou equiparado (importador, atacadista de cigarro, filial de importador). Alíquotas na TIPI (Tabela de Incidência do IPI). Imunes: exportações, produtos com alíquota zero na TIPI.',
    vigenciaInicio: new Date('2010-06-25'),
  },
  // ── DIFAL ─────────────────────────────────────────────────────────────────
  {
    tipo: 'RICMS', uf: null,
    numero: 'EC 87/2015 + LC 190/2022',
    artigo: 'Art. 1º',
    assunto: 'DIFAL diferencial alíquota não contribuinte consumidor final',
    texto: 'DIFAL: Diferencial de alíquota de ICMS devido nas operações interestaduais destinadas a consumidor final não contribuinte do ICMS (pessoa física ou PJ não optante pelo ICMS). O DIFAL é calculado como: alíquota interna do estado destino − alíquota interestadual aplicada. LC 190/2022 regulamentou a partilha: 60% para o estado destino e 40% para o estado origem em 2022, chegando a 100% para o destino a partir de 2026. A partir de 2026, DIFAL integral para o estado de destino.',
    vigenciaInicio: new Date('2022-01-01'),
  },
  // ── ICMS-ST ───────────────────────────────────────────────────────────────
  {
    tipo: 'RICMS', uf: null,
    numero: 'Lei Complementar 87/1996 — Lei Kandir',
    artigo: 'Art. 6º / Art. 8º',
    assunto: 'ICMS substituição tributária ST retenção responsabilidade',
    texto: 'ICMS-ST: regime em que a responsabilidade pelo recolhimento do imposto é atribuída ao contribuinte substituto (geralmente o fabricante ou importador). O substituto retém e recolhe o ICMS de toda a cadeia até o consumidor final. Base de cálculo: valor da operação + MVA (Margem de Valor Agregado) ou pauta fiscal do estado. Produtos sujeitos a ST: combustíveis, cigarros, cervejas, refrigerantes, autopeças, tintas, medicamentos, entre outros — conforme convênios ICMS do CONFAZ.',
    vigenciaInicio: new Date('1997-01-01'),
  },
  // ── Reforma Tributária — CBS/IBS ──────────────────────────────────────────
  {
    tipo: 'LC214', uf: null,
    numero: 'Lei Complementar 214/2025',
    artigo: 'Art. 1º ao Art. 30',
    assunto: 'CBS IBS reforma tributária incidência fato gerador',
    texto: `CBS (Contribuição sobre Bens e Serviços): substitui PIS e COFINS. Competência federal. Alíquota de referência estimada: ~8,8%. Não-cumulativa, com creditamento amplo.
IBS (Imposto sobre Bens e Serviços): substitui ICMS e ISS. Competência dual (estados e municípios). Gerido pelo Comitê Gestor do IBS. Alíquota de referência total estimada: ~17,7% (soma das alíquotas estadual + municipal).
IS (Imposto Seletivo): incide sobre bens e serviços prejudiciais à saúde ou ao meio ambiente (cigarros, bebidas alcoólicas, veículos, etc.).
Período de transição: 2026–2033. CBS e IBS coexistem com PIS/COFINS, ICMS e ISS durante a transição.
Split payment: o imposto é segregado no ato do pagamento pelo sistema financeiro, sem que o vendedor receba o montante do tributo.`,
    vigenciaInicio: new Date('2025-01-01'),
  },
  {
    tipo: 'LC214', uf: null,
    numero: 'Lei Complementar 214/2025',
    artigo: 'Art. 58 — Regime de Transição',
    assunto: 'CBS IBS transição alíquota reduzida teste 2026 2027',
    texto: `2026: CBS com alíquota reduzida de teste (0,9%). IBS com alíquota reduzida de teste (0,1%).
2027: CBS plena substitui PIS/COFINS. IBS começa substituição gradual de ICMS/ISS.
2029-2033: redução progressiva de ICMS (10% ao ano) e ISS.
2033: extinção de PIS, COFINS, ICMS e ISS. CBS e IBS em vigor pleno.`,
    vigenciaInicio: new Date('2025-01-01'),
  },
];
