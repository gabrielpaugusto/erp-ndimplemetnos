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
  // ── ICMS-ST — Lei Kandir (base federal) ──────────────────────────────────
  {
    tipo: 'RICMS', uf: null,
    numero: 'Lei Complementar 87/1996 — Lei Kandir',
    artigo: 'Art. 6º / Art. 8º',
    assunto: 'ICMS substituição tributária ST retenção responsabilidade fabricante importador',
    texto: 'ICMS-ST: regime em que a responsabilidade pelo recolhimento do imposto é atribuída ao contribuinte substituto (geralmente o fabricante ou importador). O substituto retém e recolhe o ICMS de toda a cadeia até o consumidor final. Base de cálculo: valor da operação + MVA (Margem de Valor Agregado) ou pauta fiscal do estado. Produtos sujeitos a ST: combustíveis, cigarros, cervejas, refrigerantes, autopeças, tintas, medicamentos, implementos rodoviários parcialmente, entre outros — conforme convênios ICMS do CONFAZ. A ST pressupõe existência de operações subsequentes tributadas; quando não há (consumidor final, industrialização), a ST não se aplica.',
    vigenciaInicio: new Date('1997-01-01'),
  },

  // ── ICMS-ST — RICMS-SP Art. 264: Hipóteses de NÃO-RETENÇÃO ──────────────
  {
    tipo: 'RICMS', uf: 'SP',
    numero: 'RICMS-SP (Decreto 45.490/2000)',
    artigo: 'Art. 264 — Hipóteses de não-retenção do ICMS-ST',
    assunto: 'ICMS substituição tributária não retenção ST industrialização filial protocolo interestadual exceção art 264',
    texto: `Art. 264 do RICMS-SP: Salvo disposição em contrário, não se inclui na sujeição passiva por substituição, subordinando-se às normas comuns da legislação, a saída destinada a:

INCISO I — integração ou consumo em processo de industrialização.
Aplicação: quando o destinatário for estabelecimento industrial que usará o produto como INSUMO ou o CONSUMIRÁ no processo produtivo (não para revenda). O produto não chega ao consumidor final naquela forma, logo a ST não se justifica. Para aplicar: o destinatário deve fornecer DECLARAÇÃO ESCRITA ao remetente informando que o produto será integrado/consumido em industrialização. O remetente deve incluir no campo <infCpl> da NF-e: "Operação não sujeita à ST — Art. 264, I, RICMS/2000 — Mercadoria destinada à integração em processo de industrialização". Se o comprador fizer declaração falsa, o risco e a responsabilidade são do declarante (RC 24167/2021).

INCISO II — estabelecimento paulista quando a operação subsequente for amparada por isenção ou não-incidência.

INCISO III — outro estabelecimento do mesmo titular (filial), desde que não seja varejista. O destinatário assume a obrigação de retenção para as operações subsequentes (§1º). Não se aplica se a filial for exclusivamente varejista (§3º).

INCISO IV — outro estabelecimento responsável pelo pagamento do imposto por substituição, em relação à mesma mercadoria ou modalidade de substituição. O destinatário deve ser inscrito como substituto tributário do segmento. A responsabilidade migra para ele (§1º).

INCISO V — estabelecimento situado em outro Estado. EXCEÇÃO: se existir protocolo ou convênio ICMS ativo entre o estado de origem e o estado de destino para aquele NCM, a ST se aplica normalmente mesmo na operação interestadual.

INCISO VI — estabelecimento com regime especial que o autoriza a assumir a posição de substituto tributário.

REGRA GERAL: a ST pressupõe cadeia de comercialização futura. Se o produto vai ser transformado, consumido ou a operação é isenta, a ST não é devida. A falta de protocolo ativo entre estados também afasta a ST interestadual.`,
    vigenciaInicio: new Date('2000-12-01'),
  },

  // ── ICMS-ST — RICMS-SP Art. 272: Crédito para INDUSTRIALIZAÇÃO (CST 60) ─
  {
    tipo: 'RICMS', uf: 'SP',
    numero: 'RICMS-SP (Decreto 45.490/2000)',
    artigo: 'Art. 271 / Art. 272 — Crédito de ICMS quando entrada com ST é destinada à industrialização',
    assunto: 'ICMS ST ressarcimento crédito industrialização CST 60 art 272 SPED C197 E110 escrituração',
    texto: `Art. 272 do RICMS-SP: o contribuinte que receber mercadoria com ICMS-ST já retido (CST 60) e NÃO a destinar à comercialização subsequente (ex.: destina à industrialização, ativo, uso e consumo) poderá aproveitar como CRÉDITO FISCAL o valor do imposto incidente sobre a OPERAÇÃO PRÓPRIA do substituto (fornecedor).

CÁLCULO DO CRÉDITO (Art. 271 §1º):
  Crédito = Alíquota interna de SP × BC que seria atribuída ao remetente em regime comum
  BC do remetente = valor da NF-e de entrada (sem incluir a parcela de ST)
  Limite: crédito ≤ alíquota interna × BC da retenção de ST (Art. 271 §2º)

ATENÇÃO — o Art. 272 cobre APENAS o crédito da "operação própria" do substituto (o ICMS normal que o fornecedor pagaria em regime comum). Para ressarcir a DIFERENÇA de ST (o "plus" antecipado pela substituição), é necessário acionar o Art. 269 + Portaria CAT 42/2018 via sistema e-Ressarcimento.

LANÇAMENTOS SPED FISCAL obrigatórios:
  C100: NF-e de entrada com CST 60
  C170: Item com CSOSN/CST = 60
  C197: Ajuste de documento fiscal com código de ajuste SP para crédito Art. 271/272 (família SP60XXXXXX — verificar tabela SEFAZ-SP vigente)
  E110: Apuração ICMS — campo "Outros Créditos"

PRAZO: prazo geral de aproveitamento de crédito — 5 anos (Art. 150 §4º CTN). Lançar no período em que a mercadoria é aplicada no processo industrial.

QUANDO USAR: somente quando a mercadoria com entrada CST 60 for destinada à industrialização (insumo na fabricação de produto final). Para revenda ou uso em oficina de serviços: NÃO gera crédito pelo Art. 272.

VERIFICAÇÃO PENDENTE: confirmar com SEFAZ-SP se o crédito escritural do Art. 272 passou a exigir transmissão via sistema e-Ressarcimento (Portaria CAT 42/2018) após as atualizações de 2021-2023.`,
    vigenciaInicio: new Date('2000-12-01'),
  },

  // ── ICMS-ST — RICMS-SP Art. 269: Ressarcimento Formal ────────────────────
  {
    tipo: 'RICMS', uf: 'SP',
    numero: 'RICMS-SP (Decreto 45.490/2000) + Portaria CAT 42/2018',
    artigo: 'Art. 269 / Art. 270 — Ressarcimento formal de ICMS-ST + e-Ressarcimento',
    assunto: 'ICMS ST ressarcimento formal art 269 art 270 e-Ressarcimento CAT 42 GIA devolução perda saída interestadual',
    texto: `Art. 269 do RICMS-SP — Hipóteses de ressarcimento formal do ICMS-ST (quando o substituído tem direito a recuperar o imposto retido antecipadamente):

INCISO I: retenção a maior — valor de ST retido foi calculado sobre base maior que o preço final efetivamente praticado na venda ao consumidor.
INCISO II: fato gerador presumido não realizado — a venda ao consumidor não ocorreu (devolução, perda, furto, sinistro).
INCISO III: saída amparada por isenção ou não-incidência — operação de saída do substituído é desonerada.
INCISO IV: saída interestadual posterior — o substituído vende a mercadoria para outro Estado; o ICMS-ST retido em SP não se aplica à operação no destino.

COMO FAZER O RESSARCIMENTO (Portaria CAT 42/2018 — sistema e-Ressarcimento):
1. Transmitir arquivo digital mensal ao sistema e-Ressarcimento da SEFAZ-SP com todas as movimentações de mercadorias ST do período.
2. Aguardar validação e emissão de Visto Eletrônico pelo sistema.
3. Escolher modalidade: (a) compensação escritural — lança na GIA com código "007.99 — Visto Eletrônico n. XXXXX"; (b) transferência para outro estabelecimento; (c) pedido de ressarcimento em dinheiro; (d) liquidação de débito fiscal.
4. Lançar no SPED Fiscal: Registro E110 "Outros Créditos" + E116 se necessário.

DISTINÇÃO CRUCIAL: Art. 269 → ressarcimento FORMAL para as hipóteses acima (devolução, saída isenta, saída interestadual, etc.) — exige e-Ressarcimento. Art. 272 → crédito ESCRITURAL para industrialização — lançamento direto no SPED sem necessidade de pedido formal (verificar atualização SEFAZ-SP 2021-2023).`,
    vigenciaInicio: new Date('2018-04-01'),
  },

  // ── ICMS-ST — Decisão Normativa CAT 12/2009: Dupla Condição ─────────────
  {
    tipo: 'RICMS', uf: 'SP',
    numero: 'Decisão Normativa CAT 12/2009',
    artigo: 'Dupla condição para sujeição à ST — NCM + Descrição',
    assunto: 'substituição tributária ST autopeças NCM descrição dupla condição sujeição CAT 12 8708',
    texto: `Decisão Normativa CAT 12/2009 — SEFAZ-SP: Para que um produto esteja sujeito ao regime de substituição tributária de ICMS no Estado de São Paulo, ele deve atender SIMULTANEAMENTE a dois requisitos:

1. O NCM (Nomenclatura Comum do Mercosul) do produto deve corresponder ao NCM listado na portaria ou convênio que institui a ST para o segmento.
2. A DESCRIÇÃO do produto deve corresponder à descrição do item listado na mesma portaria/convênio.

CONSEQUÊNCIA PRÁTICA: não basta que o NCM do produto conste na tabela de ST. Se a descrição do produto não corresponder ao item listado, ele NÃO está sujeito à ST, mesmo que o NCM coincida numericamente.

EXEMPLO para fabricante de implementos rodoviários:
- NCM 8708.99.99 (partes de veículos) pode constar na Portaria CAT/SRE para autopeças.
- Se o produto fabricado pela empresa (ex.: "braço de suspensão para semirreboque") não corresponde à descrição listada na portaria (ex.: "braço de suspensão para veículos automotores de passageiros"), ele NÃO é ST mesmo com o NCM coincidindo.

PARA O FISCALBRAIN: sempre verificar DESCRIÇÃO + NCM antes de sinalizar ST. A simples correspondência de NCM não é suficiente. Quando houver dúvida sobre a descrição, gerar alerta/exceção para revisão do fiscal.

FONTE: Resposta a Consulta RC 28115/2023 confirma esse entendimento para NCM 8716.90.90 — peças de engate ≠ engate completo CEST 01.077.00.`,
    vigenciaInicio: new Date('2009-01-01'),
  },

  // ── ICMS-ST — Protocolo ICMS 41/2008: SP ↔ MG Autopeças ─────────────────
  {
    tipo: 'RICMS', uf: 'SP',
    numero: 'Protocolo ICMS 41/2008 — CONFAZ',
    artigo: 'Substituição tributária interestadual — Autopeças SP ↔ MG e demais signatários',
    assunto: 'protocolo ICMS 41 2008 autopeças SP MG interestadual MVA IVA ST GNRE substituição tributária 8708',
    texto: `Protocolo ICMS 41/2008 (CONFAZ) — Regula a substituição tributária para operações interestaduais com peças, partes, componentes, acessórios e demais produtos de uso automotivo (NCM 8708 e correlatos).

ESTADOS SIGNATÁRIOS (posição 2025): Acre, Alagoas, Amapá, Amazonas, Bahia, Maranhão, Mato Grosso, Minas Gerais, Pará, Paraíba, Paraná, Piauí, São Paulo e Distrito Federal.

RESPONSÁVEL PELA RETENÇÃO: o estabelecimento remetente (fabricante ou importador em SP) é o substituto — retém e recolhe o ICMS-ST para o estado de destino.

MVA (Margem de Valor Agregado) ORIGINAL:
  - 36,56% — para saídas de fabricante de veículos com cláusula de fidelidade contratual de compra.
  - 71,78% — demais casos (regra geral para a empresa).

MVA AJUSTADO para operações interestaduais (obrigatório):
  Fórmula: MVA ajustado = [(1 + MVA original) × (1 − ALQ inter) / (1 − ALQ interna destino)] − 1

  Exemplo SP → MG (MVA 71,78% | ALQ inter 12% | ALQ interna MG 18%):
  MVA ajustado = [(1 + 0,7178) × (1 − 0,12) / (1 − 0,18)] − 1
               = [1,7178 × 0,88 / 0,82] − 1
               ≈ 84,35%

CÁLCULO COMPLETO (exemplo):
  Valor item (NF):          R$ 10.000,00
  IPI (ex. 5%):             R$    500,00
  Frete:                    R$    300,00
  Subtotal antes do MVA:    R$ 10.800,00
  BC-ST (× 1,8435):         R$ 19.910,00
  ICMS-ST = BC-ST × 18% − ICMS próprio (10.000 × 12%)
           = R$  3.583,80 − R$  1.200,00 = R$  2.383,80

RECOLHIMENTO: GNRE (Guia Nacional de Recolhimento) por NF-e para o estado de destino. Se a empresa tiver inscrição estadual em MG como substituta, pode recolher mensalmente.

CFOP correto: 6.401 (venda de produção própria em operação com ST interestadual).
CST correto: 10 (tributado + ST para frente).
CEST: 01.075.00 para NCM 8708.xx.

ATENÇÃO: verificar lista de exclusões de 2025/2026 — alguns CESTs foram retirados do regime de ST interestadual.`,
    vigenciaInicio: new Date('2008-01-01'),
  },

  // ── ICMS-ST — RICMS-SP Art. 313-O/313-P: ST Autopeças Interna SP ─────────
  {
    tipo: 'RICMS', uf: 'SP',
    numero: 'RICMS-SP Arts. 313-O e 313-P + Portaria SRE 16/2023',
    artigo: 'Substituição tributária interna SP — Autopeças NCM 8708',
    assunto: 'substituição tributária interna SP autopeças 8708 IVA ST 313-O 313-P portaria SRE 47 71',
    texto: `Arts. 313-O e 313-P do RICMS-SP regulam a substituição tributária INTERNA para autopeças no Estado de São Paulo.

PRODUTOS ABRANGIDOS: peças, partes, componentes, acessórios e produtos de uso automotivo com NCM 8708.xx.xx e outros NCMs listados na Portaria CAT 68/2019 (Anexo XIV) e Portaria SRE 16/2023 e sucessoras — DESDE QUE atendam à dupla condição NCM + descrição (Decisão Normativa CAT 12/2009).

IVA-ST (índice de valor agregado) INTERNO PARA SP:
  - 47,19% — para saídas de fabricante de veículos automotores com cláusula de fidelidade contratual.
  - 71,78% — demais casos (regra geral).

CFOP na saída SP→SP com ST: 5.401 (fabricação própria como substituto).
CST: 10 (tributado + cobrança ST).
CEST: 01.075.00.

BASE DE CÁLCULO ST interna:
  BC-ST = (valor mercadoria + frete + seguro + IPI + outros encargos) × (1 + IVA-ST)
  ICMS-ST = BC-ST × alíquota interna SP − ICMS operação própria

ALÍQUOTA INTERNA SP para autopeças: verifique alíquota aplicável — produtos do Art. 54 podem ter 12%; demais geralmente 18%. Confirmar pela TIPI e pela legislação de alíquotas do RICMS-SP.

NOTA: Para implementos rodoviários COMPLETOS (NCM 8716.10 a 8716.40), NÃO há ST interna em SP. Apenas NCM 8716.90.90 (engates completos, CEST 01.077.00) está sujeito à ST interna.`,
    vigenciaInicio: new Date('2008-01-01'),
  },

  // ── ICMS-ST — CEST: Convênio ICMS 142/2018 ────────────────────────────────
  {
    tipo: 'RICMS', uf: null,
    numero: 'Convênio ICMS 142/2018 — CONFAZ + Ajuste SINIEF 22/2017',
    artigo: 'CEST — Código Especificador da Substituição Tributária',
    assunto: 'CEST código especificador substituição tributária NF-e obrigatório 01.075.00 01.077.00 8708 8716 convênio 142',
    texto: `CEST (Código Especificador da Substituição Tributária) foi instituído pelo Convênio ICMS 92/2015 e consolidado no Convênio ICMS 142/2018.

ESTRUTURA: código de 7 dígitos (XX.XXX.XX) onde os dois primeiros identificam o segmento (01 = autopeças e implementos), os três seguintes o item e os dois finais o subitem.

OBRIGATORIEDADE (Cláusula Vigésima do Convênio 142/2018 + Ajuste SINIEF 22/2017):
O CEST DEVE ser informado na NF-e (tag <CEST> no XML) SEMPRE QUE O PRODUTO TIVER CEST ATRIBUÍDO pelo Convênio, independentemente de a operação específica estar ou não sujeita à ST.

CEST CORRETOS para fabricante de implementos rodoviários:
  - NCM 8708.xx.xx (autopeças): CEST 01.075.00
  - NCM 8716.90.90 ENGATE COMPLETO: CEST 01.077.00
  - NCM 8716.10 a 8716.40 (implementos completos): SEM CEST — não listados no Convênio 142/2018

EXEMPLOS DE USO:
  - Venda de autopeça (8708) para industrialização (sem ST por Art. 264 I): informar CEST 01.075.00 mesmo sem ST.
  - Venda de semirreboque completo (8716.39.00): NÃO informar CEST — produto não consta no Convênio 142/2018.
  - Venda de engate (8716.90.90) em SP: informar CEST 01.077.00, verificar ST.

REGRA PRÁTICA PARA NF-e: produto com CEST → campo obrigatório no XML independente de haver ou não retenção de ST na operação.`,
    vigenciaInicio: new Date('2018-10-01'),
  },

  // ── ICMS-ST — NCM 8716: Implementos Rodoviários (sem ST, exceto engates) ─
  {
    tipo: 'RICMS', uf: 'SP',
    numero: 'RICMS-SP + RC 28115/2023 — SEFAZ-SP',
    artigo: 'NCM 8716 — Implementos rodoviários: ST apenas para engates (CEST 01.077.00)',
    assunto: 'implementos rodoviários reboque semirreboque NCM 8716 ST substituição tributária engate CEST sem ST',
    texto: `Tratamento de ST para NCM 8716.xx no Estado de São Paulo:

NCM 8716.10.00 — Reboques e semirreboques para habitação ou camping: SEM ST em SP.
NCM 8716.20.00 — Semirreboques para transporte de mercadorias (tanque, cisterna): SEM ST em SP.
NCM 8716.31.00 — Semirreboques frigoríficos: SEM ST em SP.
NCM 8716.39.00 — Outros semirreboques: SEM ST em SP.
NCM 8716.40.00 — Outros reboques e semirreboques: SEM ST em SP.
NCM 8716.90.90 — ENGATE COMPLETO para reboque/semirreboque (CEST 01.077.00): COM ST em SP.
NCM 8716.90.90 — PEÇAS E PARTES de engate (que não sejam o engate completo): SEM ST em SP (RC 28115/2023).

FUNDAMENTO: Implementos rodoviários completos não constam na lista de produtos sujeitos à ST em SP. Apenas os engates completos (CEST 01.077.00) estão incluídos na portaria de ST para autopeças/implementos (Portaria CAT 68/2019, Anexo XIV, item 79).

CFOP para implemento completo (sem ST): 5.101 (interno) ou 6.101 (interestadual) — produção própria.
CFOP para engate completo (com ST em SP): 5.401.

ATENÇÃO: não reter ST nas saídas de semirreboques completos. Erro comum que gera crédito indevido ao destinatário e possível autuação. Confirmar em RC 28115/2023 — SEFAZ-SP.

OPERAÇÕES INTERESTADUAIS (8716): não há protocolo ICMS entre SP e demais estados para implementos — a ST interestadual não se aplica (Art. 264, V do RICMS-SP).`,
    vigenciaInicio: new Date('2023-01-01'),
  },

  // ── ICMS-ST — Fórmula MVA Ajustado (fundamento legal) ────────────────────
  {
    tipo: 'RICMS', uf: null,
    numero: 'RICMS-SP Art. 41 §5º + Convênio ICMS 142/2018 Cláusula 13ª',
    artigo: 'MVA Ajustado — Fórmula para operações interestaduais com protocolo de ST',
    assunto: 'MVA ajustado fórmula cálculo interestadual alíquota protocolo IVA ST base de cálculo',
    texto: `MVA AJUSTADO — obrigatório nas operações interestaduais quando há protocolo ou convênio de ST entre os estados.

FUNDAMENTO: A Cláusula 13ª do Convênio ICMS 142/2018 (e disposição equivalente nos protocolos) exige o ajuste do MVA para equalizar a carga tributária de ST nas operações interestaduais, considerando que o substituto paga alíquota interestadual (menor) na sua operação própria, enquanto o estado de destino usa a alíquota interna para calcular o imposto presumido da cadeia.

FÓRMULA (obrigatória nos protocolos):
  MVA ajustado = [(1 + MVA original) × (1 − ALQ inter) / (1 − ALQ interna destino)] − 1

PARÂMETROS:
  ALQ inter = alíquota ICMS interestadual aplicada pelo remetente:
    - 4% para produtos importados (Res. Senado 13/2012)
    - 7% para operações de SP para estados das regiões Norte, Nordeste, Centro-Oeste e Espírito Santo
    - 12% para operações de SP para estados do Sul e Sudeste (exceto ES) e DF
  ALQ interna destino = alíquota interna do estado de destino para aquela mercadoria
    - MG: geralmente 18% (verificar produto específico)
    - PR: geralmente 18%
    - RS: geralmente 18% ou 12% conforme o produto

EXEMPLOS (MVA original 71,78%):
  SP → MG (ALQ inter 12%, ALQ interna MG 18%):
    MVA aj. = [(1,7178 × 0,88) / 0,82] − 1 = 84,35%

  SP → PR (ALQ inter 12%, ALQ interna PR 18%):
    MVA aj. = [(1,7178 × 0,88) / 0,82] − 1 = 84,35%

  SP → BA (ALQ inter 7%, ALQ interna BA 20,5%):
    MVA aj. = [(1,7178 × 0,93) / 0,795] − 1 = 100,88%

  SP → MG com produto importado (ALQ inter 4%, ALQ interna MG 18%):
    MVA aj. = [(1,7178 × 0,96) / 0,82] − 1 = 101,25%

POR QUE O MVA AJUSTADO É MAIOR QUE O ORIGINAL: o substituto paga menor alíquota na operação própria interestadual (7% ou 12%) mas o estado de destino exige o imposto calculado sobre sua alíquota interna mais alta. A fórmula eleva o MVA para compensar essa diferença.`,
    vigenciaInicio: new Date('2018-10-01'),
  },

  // ── ICMS-ST — Declaração do Comprador (Art. 264 I) ───────────────────────
  {
    tipo: 'RICMS', uf: 'SP',
    numero: 'Resposta a Consulta RC 24167/2021 — SEFAZ-SP',
    artigo: 'Art. 264 I — Declaração de industrialização e responsabilidade do declarante',
    assunto: 'declaração industrialização art 264 responsabilidade substituto declarante comprador ST não retenção',
    texto: `RC 24167/2021 — SEFAZ-SP: Regula a responsabilidade nas operações em que o substituto não retém o ICMS-ST com base na declaração do comprador de que o produto será destinado à industrialização (Art. 264, I, RICMS-SP).

DECLARAÇÃO NECESSÁRIA — o comprador deve fornecer ao vendedor declaração escrita contendo:
  1. Razão social, CNPJ e Inscrição Estadual do declarante.
  2. Descrição da mercadoria adquirida (NCM e descrição).
  3. Afirmação expressa de que o produto será integrado ou consumido em processo de industrialização próprio.
  4. Identificação do produto resultante do processo produtivo (ex.: "fabricação de implementos rodoviários").
  5. Data e assinatura do responsável legal.

NOTA NA NF-E DE SAÍDA — o remetente (vendedor) deve incluir no campo <infCpl>:
"Operação não sujeita à substituição tributária — Art. 264, inciso I, do RICMS/SP (Decreto 45.490/2000) — Mercadoria destinada à integração em processo de industrialização pelo destinatário."

RESPONSABILIDADE DO VENDEDOR (substituto): se agir de boa-fé e possuir a declaração do comprador, fica ISENTO de responsabilidade por eventual não-retenção indevida. Não há responsabilidade solidária automática quando o vendedor não concorreu para a fraude.

RESPONSABILIDADE DO COMPRADOR (declarante): se a declaração for falsa (produto não foi para industrialização), o comprador será responsável pelo ICMS-ST não retido, acrescido de multa e juros. A SEFAZ-SP autuará o declarante, não o vendedor.

RECOMENDAÇÃO PARA O ERP: gerar e arquivar a declaração como documento vinculado à NF-e. Alertar o fiscal quando o mesmo produto, na mesma empresa, for posteriormente processado em operação de revenda sem evidência de industrialização.`,
    vigenciaInicio: new Date('2021-01-01'),
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
