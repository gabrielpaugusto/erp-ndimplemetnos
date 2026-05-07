import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { KnowledgeBaseService } from './knowledge-base.service';

export interface ContextoOperacao {
  // Empresa (tomadora/destinatária da operação)
  cnaeEmitente: string;
  regimeTributario: 'SN' | 'LP' | 'LR';
  ufEmitente: string;
  isIndustrial: boolean; // estabelecimento industrial?

  // Contraparte (fornecedor em ENTRADA / cliente em SAIDA)
  ufDestinatario: string;
  isContribuinte: boolean; // contribuinte do ICMS?
  cnaeDestinatario?: string;
  isConsumidorFinal: boolean;
  /**
   * Ramo de atividade da contraparte: INDUSTRIA, ATACADISTA_EQUIPARADO, COMERCIO,
   * PRESTADOR_SERVICO, IMPORTADOR, PESSOA_FISICA.
   * Substitui o campo legado tipoFornecedor para classificação fiscal.
   */
  ramoAtividadeFornecedor?: string;
  /**
   * Natureza jurídica da contraparte: MEI, EI, SLU, LTDA, SA_FECHADA, SA_ABERTA,
   * SS, COOPERATIVA, ASSOCIACAO, FUNDACAO, ORGAO_PUBLICO, OUTROS.
   * MEI é natureza jurídica — fiscalmente tratado como Simples Nacional.
   */
  naturezaJuridicaFornecedor?: string;
  /**
   * Regime tributário da contraparte: SIMPLES_NACIONAL, LUCRO_PRESUMIDO, LUCRO_REAL.
   * MEI não é regime — se o fornecedor é MEI, informe SIMPLES_NACIONAL aqui.
   */
  taxRegimeFornecedor?: string;

  // Operação
  tipoOperacao: 'SAIDA' | 'ENTRADA';
  naturezaOperacao: string; // texto livre da NF
  produtos: {
    ncm: string;
    descricao: string;
    valor: number;
    quantidade: number;
    unit: string;
  }[];

  // ── Substituição Tributária ──────────────────────────────────────────────
  /**
   * Finalidade da compra pelo destinatário. Define se a ST se aplica.
   * REVENDA         → ST incide (se houver protocolo e NCM sujeito)
   * INDUSTRIALIZACAO → Art. 264 I → ST não incide (exige declaração)
   * USO_CONSUMO     → Art. 264 → ST não incide
   * ATIVO_IMOBILIZADO → Art. 264 → ST não incide
   */
  finalidadeDestinatario?: 'REVENDA' | 'INDUSTRIALIZACAO' | 'USO_CONSUMO' | 'ATIVO_IMOBILIZADO';
  /**
   * Indica se existe protocolo/convênio ST ativo entre ufEmitente e ufDestinatario
   * para o(s) NCM(s) da operação. Pré-consultado pelo STDetectorService antes
   * de chamar o FiscalBrain. Se undefined → Brain consulta pela lógica interna.
   */
  temProtocoloST?: boolean;
  /**
   * Quando entrada com CST 60: indica se o item será destinado à industrialização
   * (aciona crédito Art. 272 RICMS-SP) ou à revenda/uso (sem crédito).
   */
  destinacaoEntradaCST60?: 'INDUSTRIALIZACAO' | 'REVENDA' | 'USO_CONSUMO';

  // Histórico (últimas operações similares para contexto)
  operacoesSimilares?: {
    cfop: string;
    natureza: string;
    confianca: number;
  }[];
}

export interface ClassificacaoFiscal {
  cfop: string;
  cstIcms: string;
  cstPis: string;
  cstCofins: string;
  aliquotaIcms: number;
  baseCalculoIcmsPct: number; // % da base (redução)
  temIcmsSt: boolean;
  aliquotaPis: number;
  aliquotaCofins: number;
  temIpi: boolean;
  aliquotaIpi: number;
  beneficioFiscal: string | null;
  fundamentoLegal: string[];
  raciocinio: string;
  alternativas: { cfop: string; raciocinio: string; descartadoPor: string }[];
  alertas: string[];
  confianca: number; // 0–100
}

@Injectable()
export class ClassificadorService {
  private readonly logger = new Logger(ClassificadorService.name);
  private readonly anthropic: Anthropic;
  private readonly THRESHOLD = 92;

  constructor(private readonly kb: KnowledgeBaseService) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async classificar(ctx: ContextoOperacao): Promise<ClassificacaoFiscal> {
    // 1. Busca legislação relevante
    const legislacao = await this.kb.buscar({
      ufEmitente: ctx.ufEmitente,
      ufDestinatario: ctx.ufDestinatario,
      ncms: ctx.produtos.map((p) => p.ncm),
      palavrasChave: this.extrairPalavrasChave(ctx),
    });

    // 2. Monta prompt
    const prompt = this.buildPrompt(ctx, legislacao.trechos);

    // 3. Chama Claude
    let raw: string;
    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
        system: SYSTEM_PROMPT,
      });
      raw = (message.content[0] as { type: string; text: string }).text;
    } catch (e) {
      this.logger.error(`Anthropic API error: ${e?.message}`);
      throw new Error(`Falha ao consultar IA: ${e?.message}`);
    }

    // 4. Parse JSON
    return this.parseResposta(raw);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private extrairPalavrasChave(ctx: ContextoOperacao): string[] {
    const words: string[] = [ctx.naturezaOperacao];
    if (ctx.isIndustrial) words.push('industrialização', 'produto industrializado');
    if (ctx.isContribuinte) words.push('contribuinte');
    if (!ctx.isContribuinte && ctx.isConsumidorFinal) words.push('consumidor final', 'DIFAL');
    if (ctx.ufEmitente !== ctx.ufDestinatario) words.push('interestadual');
    // Enriquece com ramo de atividade da contraparte
    if (ctx.ramoAtividadeFornecedor === 'INDUSTRIA') words.push('industrialização', 'fabricante', 'CFOP 1.101');
    if (ctx.ramoAtividadeFornecedor === 'IMPORTADOR') words.push('importação', 'produto importado', 'Res. Senado 13/2012', 'ICMS 4%');
    if (ctx.ramoAtividadeFornecedor === 'PRESTADOR_SERVICO') words.push('serviço', 'NFS-e', 'ISS');
    if (ctx.ramoAtividadeFornecedor === 'ATACADISTA_EQUIPARADO') words.push('atacado', 'equiparado', 'crédito integral');
    // Enriquece com regime/natureza jurídica do fornecedor
    if (ctx.taxRegimeFornecedor === 'SIMPLES_NACIONAL') words.push('Simples Nacional', 'CSOSN', 'sem crédito ICMS');
    if (ctx.naturezaJuridicaFornecedor === 'MEI') words.push('MEI', 'microempreendedor', 'Simples Nacional');
    // ── Substituição Tributária ──────────────────────────────────────────────
    const ncms = ctx.produtos.map(p => p.ncm);
    const temNcm8708 = ncms.some(n => n.startsWith('8708'));
    const temNcm8716 = ncms.some(n => n.startsWith('8716'));
    if (temNcm8708) words.push('autopeças', 'substituição tributária', 'Protocolo 41/2008', 'CEST 01.075.00', 'ST autopeças', 'IVA-ST');
    if (temNcm8716) words.push('implementos rodoviários', 'reboque', 'semirreboque', '8716', 'engate', 'CEST 01.077.00', 'ST implementos', 'Art. 264');
    if (ctx.finalidadeDestinatario === 'INDUSTRIALIZACAO') words.push('industrialização', 'Art. 264 inciso I', 'não retenção ST', 'declaração comprador');
    if (ctx.finalidadeDestinatario === 'REVENDA') words.push('revenda', 'substituição tributária', 'cadeia comercial', 'ST');
    if (ctx.finalidadeDestinatario === 'USO_CONSUMO') words.push('uso consumo', 'Art. 264', 'sem ST', 'não retenção');
    if (ctx.finalidadeDestinatario === 'ATIVO_IMOBILIZADO') words.push('ativo imobilizado', 'Art. 264', 'sem ST');
    if (ctx.tipoOperacao === 'ENTRADA') words.push('crédito ICMS entrada', 'CST 60', 'ressarcimento', 'Art. 272', 'ST retida');
    if (ctx.temProtocoloST === true) words.push('protocolo ST ativo', 'ST interestadual', 'GNRE', 'MVA ajustado');
    if (ctx.temProtocoloST === false) words.push('sem protocolo ST', 'Art. 264 inciso V', 'sem retenção interestadual');
    return words;
  }

  private buildPrompt(ctx: ContextoOperacao, trechos: { numero: string; artigo: string | null; assunto: string; texto: string }[]): string {
    const produtosStr = ctx.produtos
      .map((p) => `  - NCM ${p.ncm}: ${p.descricao} | Qtd: ${p.quantidade} ${p.unit} | Valor: R$${p.valor.toFixed(2)}`)
      .join('\n');

    const legislacaoStr = trechos.length
      ? trechos.map((t) => `[${t.numero}${t.artigo ? ` — ${t.artigo}` : ''}]\n${t.texto}`).join('\n\n---\n')
      : '(Base de conhecimento ainda não populada — use seu conhecimento fiscal geral)';

    const similaresStr = ctx.operacoesSimilares?.length
      ? ctx.operacoesSimilares.map((s) => `  CFOP ${s.cfop} | "${s.natureza}" | conf.${s.confianca}%`).join('\n')
      : '  (nenhum histórico disponível)';

    return `Classifique o documento fiscal abaixo para fins de escrituração.

━━ EMPRESA EMITENTE ━━
CNAE: ${ctx.cnaeEmitente}
Regime Tributário: ${ctx.regimeTributario === 'SN' ? 'Simples Nacional' : ctx.regimeTributario === 'LP' ? 'Lucro Presumido' : 'Lucro Real'}
UF: ${ctx.ufEmitente}
Estabelecimento industrial: ${ctx.isIndustrial ? 'SIM' : 'NÃO'}
Tipo de operação: ${ctx.tipoOperacao === 'SAIDA' ? 'SAÍDA' : 'ENTRADA'}

━━ DESTINATÁRIO / REMETENTE ━━
UF: ${ctx.ufDestinatario}
Contribuinte ICMS: ${ctx.isContribuinte ? 'SIM' : 'NÃO'}
Consumidor final: ${ctx.isConsumidorFinal ? 'SIM' : 'NÃO'}
${ctx.cnaeDestinatario ? `CNAE: ${ctx.cnaeDestinatario}` : ''}
${ctx.ramoAtividadeFornecedor ? `Ramo de atividade: ${ctx.ramoAtividadeFornecedor}` : ''}
${ctx.naturezaJuridicaFornecedor ? `Natureza jurídica: ${ctx.naturezaJuridicaFornecedor}` : ''}
${ctx.taxRegimeFornecedor ? `Regime tributário: ${ctx.taxRegimeFornecedor}` : ''}

━━ NATUREZA DA OPERAÇÃO ━━
${ctx.naturezaOperacao}
${ctx.finalidadeDestinatario ? `Finalidade do destinatário: ${ctx.finalidadeDestinatario}` : ''}
${ctx.temProtocoloST !== undefined ? `Protocolo ST ativo para NCM+UF: ${ctx.temProtocoloST ? 'SIM' : 'NÃO'}` : ''}
${ctx.destinacaoEntradaCST60 ? `Destinação da mercadoria com ST retida: ${ctx.destinacaoEntradaCST60}` : ''}

━━ PRODUTOS ━━
${produtosStr}

━━ LEGISLAÇÃO RELEVANTE ━━
${legislacaoStr}

━━ HISTÓRICO DE OPERAÇÕES SIMILARES ━━
${similaresStr}

━━ INSTRUÇÃO ━━
Retorne SOMENTE um JSON válido, sem markdown, sem explicação fora do JSON. Use a estrutura exata abaixo:`;
  }

  private parseResposta(raw: string): ClassificacaoFiscal {
    // Extrai JSON do texto (às vezes Claude adiciona markdown ou texto ao redor)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      this.logger.error('Resposta da IA não contém JSON válido:', raw.slice(0, 500));
      throw new Error('Resposta da IA não está no formato JSON esperado');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        cfop:              String(parsed.cfop ?? ''),
        cstIcms:           String(parsed.cst_icms ?? ''),
        cstPis:            String(parsed.cst_pis ?? ''),
        cstCofins:         String(parsed.cst_cofins ?? ''),
        aliquotaIcms:      Number(parsed.aliquota_icms ?? 0),
        baseCalculoIcmsPct: Number(parsed.base_calculo_icms_pct ?? 100),
        temIcmsSt:         Boolean(parsed.tem_icms_st ?? false),
        aliquotaPis:       Number(parsed.aliquota_pis ?? 0),
        aliquotaCofins:    Number(parsed.aliquota_cofins ?? 0),
        temIpi:            Boolean(parsed.tem_ipi ?? false),
        aliquotaIpi:       Number(parsed.aliquota_ipi ?? 0),
        beneficioFiscal:   parsed.beneficio_fiscal ?? null,
        fundamentoLegal:   Array.isArray(parsed.fundamento_legal) ? parsed.fundamento_legal : [],
        raciocinio:        String(parsed.raciocinio ?? ''),
        alternativas:      Array.isArray(parsed.alternativas) ? parsed.alternativas : [],
        alertas:           Array.isArray(parsed.alertas) ? parsed.alertas : [],
        confianca:         Math.min(100, Math.max(0, Number(parsed.confianca ?? 50))),
      };
    } catch (e) {
      this.logger.error('Erro ao parsear JSON da IA:', jsonMatch[0].slice(0, 500));
      throw new Error('JSON retornado pela IA é inválido');
    }
  }
}

// ── System prompt imutável ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é um especialista sênior em legislação tributária brasileira com 20 anos de experiência.
Sua função é classificar documentos fiscais (NF-e, NFS-e, CT-e) de forma precisa e fundamentada.

TAXONOMIA DE CLASSIFICAÇÃO DO SISTEMA (importante — não confundir os conceitos):
• Regime Tributário: SIMPLES_NACIONAL | LUCRO_PRESUMIDO | LUCRO_REAL
  – MEI NÃO é regime tributário. MEI é uma natureza jurídica que adota o Simples Nacional como regime.
  – Quando o fornecedor for MEI, trate-o como SIMPLES_NACIONAL para fins de crédito fiscal.
• Natureza Jurídica: MEI | EI | SLU | LTDA | SA_FECHADA | SA_ABERTA | SS | COOPERATIVA | ASSOCIACAO | FUNDACAO | ORGAO_PUBLICO | OUTROS
  – Determina o tipo societário, mas NÃO define o regime de tributação diretamente.
  – MEI e EI podem ser Simples Nacional; LTDA pode ser qualquer regime.
• Ramo de Atividade: INDUSTRIA | ATACADISTA_EQUIPARADO | COMERCIO | PRESTADOR_SERVICO | IMPORTADOR | PESSOA_FISICA
  – Define a natureza da operação para fins de CFOP, crédito de ICMS e PIS/COFINS.
  – Fornecedor INDUSTRIA → crédito integral de ICMS na entrada (CFOP 1.101 / 2.101).
  – Fornecedor IMPORTADOR → verificar ICMS 4% (Res. Senado 13/2012 se produto importado).
  – Fornecedor SIMPLES_NACIONAL ou MEI → sem destaque de ICMS → sem crédito na entrada.

REGRAS GERAIS:
1. Retorne APENAS um objeto JSON válido. Nada antes, nada depois.
2. Nunca invente fundamentos legais — use apenas o que foi fornecido ou o que você tem certeza.
3. Quando houver dúvida legítima, reduza a confiança (confianca < 92) em vez de inventar.
4. Considere SEMPRE o regime tributário da empresa compradora (SN, LP, LR) — as alíquotas de PIS/COFINS diferem.
5. Para Simples Nacional: use CSOSN em vez de CST ICMS.
6. Para operações interestaduais: verifique se há DIFAL, ICMS-ST, alíquota 12% ou 7%.
7. Se ramoAtividadeFornecedor = SIMPLES_NACIONAL ou taxRegimeFornecedor = SIMPLES_NACIONAL → sem crédito ICMS na entrada → CST 60 ou CSOSN correspondente.
8. Se naturezaJuridicaFornecedor = MEI → trate como Simples Nacional para todos os efeitos fiscais.

REGRAS DE SUBSTITUIÇÃO TRIBUTÁRIA — ICMS-ST (RICMS-SP e Protocolos CONFAZ):

QUANDO A ST INCIDE (cumulativamente):
  • O NCM do produto deve estar listado em portaria da CAT/SRE-SP como sujeito à ST E
  • A DESCRIÇÃO do produto deve corresponder ao item listado (Decisão Normativa CAT 12/2009 — dupla condição NCM + descrição) E
  • Para operações interestaduais: deve existir Protocolo ou Convênio ICMS ativo entre SP e a UF de destino E
  • O destinatário deve ser PJ contribuinte do ICMS com finalidade de REVENDA

QUANDO A ST NÃO INCIDE (Art. 264 RICMS-SP — qualquer uma das condições abaixo afasta a ST):
  • Destinatário vai usar o produto em INDUSTRIALIZAÇÃO (integração como insumo ou consumo no processo produtivo) → Art. 264, I — exige declaração escrita do comprador e nota <infCpl> na NF-e
  • Destinatário é PESSOA FÍSICA → sem ST (verificar DIFAL)
  • Destinatário é PJ NÃO-CONTRIBUINTE do ICMS → sem ST (verificar DIFAL)
  • Destinatário é PJ contribuinte para USO PRÓPRIO / ATIVO IMOBILIZADO / CONSUMO → sem ST
  • Destinatário é filial do mesmo titular (não varejista) → Art. 264, III → responsabilidade migra para o destinatário
  • Destino é outro Estado SEM protocolo ativo para o NCM → Art. 264, V → sem ST
  • Operação amparada por isenção ou não-incidência → Art. 264, II

NCMs ESPECÍFICOS — EMPRESA FABRICANTE DE IMPLEMENTOS RODOVIÁRIOS (SP):
  • NCM 8716.10 a 8716.40 (implementos completos: semirreboques, reboques): SEM ST em SP e SEM protocolo interestadual → CST 00, CFOP 5.101/6.101, sem CEST
  • NCM 8716.90.90 ENGATE COMPLETO (CEST 01.077.00): COM ST em SP → CST 10, CFOP 5.401
  • NCM 8716.90.90 partes/peças de engate (não o engate completo): SEM ST (RC 28115/2023)
  • NCM 8708.xx (autopeças, partes veículos): COM ST em SP (Arts. 313-O/313-P) e protocolo ativo SP→MG (Protocolo 41/2008)
    - IVA-ST SP interno: 71,78% (regra geral) ou 47,19% (fabricante veículos com fidelidade)
    - CEST: 01.075.00
    - MVA ajustado SP→MG (ALQ inter 12%, ALQ interna MG 18%): ≈ 84,35%

CFOP CORRETO PARA ST:
  • Substituto (retém ST), saída interna SP→SP: 5.401
  • Substituto (retém ST), saída interestadual: 6.401
  • Substituído (ST já recolhida anteriormente): 5.405 (entrada CST 60)
  • Sem ST por Art. 264 (industrialização, sem protocolo, consumidor final): 5.101/6.101/6.102

CST CORRETO COM ST:
  • CST 10: Tributado normal + cobrança de ST para frente (caso mais comum como substituto)
  • CST 30: Isento/não tributado + cobrança de ST
  • CST 60: ST já cobrada anteriormente (quando a ND é substituída — compra com ST retida)
  • CST 70: Com redução de BC + cobrança de ST

CRÉDITO DE ICMS EM ENTRADAS COM CST 60 (ND como substituída):
  • Mercadoria destinada à INDUSTRIALIZAÇÃO: crédito da operação própria do substituto (Art. 272 RICMS-SP) — lançar no SPED C197 + E110
  • Mercadoria destinada à REVENDA: sem crédito (e sem nova cobrança — ST já cobre)
  • Fato gerador não realizado (devolução, perda): ressarcimento formal via e-Ressarcimento (Art. 269 + Portaria CAT 42/2018)

ALERTAS OBRIGATÓRIOS — gere alerta quando:
  • temIcmsSt = true mas finalidade do destinatário não é REVENDA → ST possivelmente indevida
  • NCM 8716.xx e sistema sinalizou ST → verificar se não é implemento completo (sem ST)
  • Operação interestadual com ST mas sem protocolo confirmado → gerar exceção para revisão fiscal
  • CST 60 na entrada + destino industrialização → alertar sobre possível crédito Art. 272 RICMS-SP

ESTRUTURA JSON OBRIGATÓRIA:
{
  "cfop": "6.101",
  "cst_icms": "400",
  "cst_pis": "01",
  "cst_cofins": "01",
  "aliquota_icms": 12,
  "base_calculo_icms_pct": 100,
  "tem_icms_st": false,
  "aliquota_pis": 1.65,
  "aliquota_cofins": 7.6,
  "tem_ipi": false,
  "aliquota_ipi": 0,
  "beneficio_fiscal": null,
  "fundamento_legal": ["Resolução Senado 22/89", "RICMS-SP Art.52"],
  "raciocinio": "Explicação em português do raciocínio fiscal completo...",
  "alternativas": [
    { "cfop": "6.109", "raciocinio": "Seria usado se...", "descartado_por": "..." }
  ],
  "alertas": [],
  "confianca": 96
}`;
