import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { ClassificadorService, ContextoOperacao } from './classificador.service';

const FISCAL_BRAIN_TOOLS: Anthropic.Tool[] = [
  {
    name: 'adicionar_legislacao',
    description: 'Adiciona um artigo, regra fiscal ou padrão da empresa à base de conhecimento do FiscalBrain. Use SEMPRE que o usuário ensinar uma nova regra.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tipo: { type: 'string', description: 'Tipo: RICMS_SP, CFOP, CST, LC, DECRETO, PORTARIA_CAT, CONVENIO_ICMS, REGRA_EMPRESA' },
        uf: { type: 'string', description: 'UF aplicável (SP, MG, etc.) ou null para federal' },
        numero: { type: 'string', description: 'Número da lei/decreto/portaria ou identificador da regra' },
        artigo: { type: 'string', description: 'Artigo ou seção específica (ex: art. 54, inciso V)' },
        assunto: { type: 'string', description: 'Resumo em uma linha do que essa regra define' },
        texto: { type: 'string', description: 'Texto completo da regra, artigo ou padrão da empresa' },
        vigenciaInicio: { type: 'string', description: 'Data início vigência formato YYYY-MM-DD (opcional, padrão hoje)' },
      },
      required: ['tipo', 'numero', 'assunto', 'texto'],
    },
  },
  {
    name: 'buscar_base_conhecimento',
    description: 'Busca regras e legislação já cadastradas na base de conhecimento do FiscalBrain.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Termo de busca (CFOP, NCM, tipo de operação, etc.)' },
        uf: { type: 'string', description: 'Filtrar por UF (opcional)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'consultar_decisoes',
    description: 'Consulta decisões de classificação fiscal passadas para explicar ou auditar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        documentId: { type: 'string', description: 'ID do documento específico (opcional)' },
        cfop: { type: 'string', description: 'Filtrar por CFOP (opcional)' },
        limit: { type: 'number', description: 'Limite de resultados (padrão 5)' },
      },
      required: [],
    },
  },
  {
    name: 'classificar_operacao',
    description: 'Simula a classificação fiscal de uma operação hipotética para responder dúvidas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tipoOperacao: { type: 'string', enum: ['ENTRADA', 'SAIDA'], description: 'Tipo da operação' },
        naturezaOperacao: { type: 'string', description: 'Descrição da operação (ex: Compra de matéria-prima)' },
        ncm: { type: 'string', description: 'Código NCM do produto' },
        descricaoProduto: { type: 'string', description: 'Descrição do produto' },
        ufOrigem: { type: 'string', description: 'UF de origem (emitente)' },
        ufDestino: { type: 'string', description: 'UF de destino (destinatário)' },
        valor: { type: 'number', description: 'Valor da operação em reais' },
        ramoAtividadeFornecedor: {
          type: 'string',
          enum: ['INDUSTRIA', 'ATACADISTA_EQUIPARADO', 'COMERCIO', 'PRESTADOR_SERVICO', 'IMPORTADOR', 'PESSOA_FISICA'],
          description: 'Ramo de atividade do fornecedor/emitente (para operações de ENTRADA)',
        },
        naturezaJuridicaFornecedor: {
          type: 'string',
          enum: ['MEI', 'EI', 'SLU', 'LTDA', 'SA_FECHADA', 'SA_ABERTA', 'SS', 'COOPERATIVA', 'ASSOCIACAO', 'FUNDACAO', 'ORGAO_PUBLICO', 'OUTROS'],
          description: 'Natureza jurídica do fornecedor. MEI = Microempreendedor Individual (trata como Simples Nacional)',
        },
        taxRegimeFornecedor: {
          type: 'string',
          enum: ['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL'],
          description: 'Regime tributário do fornecedor. MEI NÃO é regime — informe SIMPLES_NACIONAL.',
        },
      },
      required: ['tipoOperacao', 'ncm', 'ufOrigem', 'ufDestino'],
    },
  },
];

function buildSystemPrompt(): string {
  return `Você é o FiscalBrain, o consultor fiscal inteligente do ERP da ND Implementos.

## EMPRESA
**ND Implementos** — fabricante de implementos rodoviários (semirreboques, baús, tanques, carrocerias)
- Estado: **São Paulo (SP)**
- Regime: Lucro Real
- CNAE principal: 2920-4 (Fabricação de implementos e equipamentos agrícolas)
- Legislação estadual principal: **RICMS/SP** — Decreto 45.490/2000

## NCMs PRINCIPAIS DA EMPRESA
- **8716** — Reboques, semirreboques e outros implementos rodoviários ← principal
- **7308** — Estruturas de ferro/aço (chassi, longarinas)
- **7326** — Obras de ferro/aço (ferragens, suportes, componentes)
- **3926** — Peças plásticas
- **8413** — Bombas para líquidos (tanques)
- **8544** — Cabos e chicotes elétricos

## CLASSIFICAÇÃO DE FORNECEDORES/CLIENTES NO ERP
O sistema utiliza três campos separados — não confunda:
- **Regime Tributário**: SIMPLES_NACIONAL | LUCRO_PRESUMIDO | LUCRO_REAL
  - MEI **não é** regime tributário — é Natureza Jurídica que adota o Simples Nacional
- **Natureza Jurídica**: MEI | EI | SLU | LTDA | SA_FECHADA | SA_ABERTA | SS | COOPERATIVA | ASSOCIACAO | FUNDACAO | ORGAO_PUBLICO | OUTROS
- **Ramo de Atividade**: INDUSTRIA | ATACADISTA_EQUIPARADO | COMERCIO | PRESTADOR_SERVICO | IMPORTADOR | PESSOA_FISICA

**Impacto fiscal do Ramo de Atividade na entrada de NF-e:**
- INDUSTRIA → crédito integral de ICMS (CFOP 1.101 / 2.101)
- ATACADISTA_EQUIPARADO → crédito integral (equiparado a industrial)
- COMERCIO → crédito conforme alíquota (CFOP 1.102 / 2.102)
- IMPORTADOR → verificar ICMS 4% (Res. Senado 13/2012)
- PRESTADOR_SERVICO → sem ICMS, incide ISS / NFS-e
- Fornecedor SIMPLES_NACIONAL ou MEI → sem destaque de ICMS → **sem crédito na entrada**

## OPERAÇÕES TÍPICAS DA EMPRESA

### ENTRADAS (Compras para industrialização)
- Matéria-prima de SP → CFOP **1.101** (para industrialização) | CST 00 | ICMS crédito integral
- Matéria-prima de outros estados → CFOP **2.101** | CST 00 | ICMS 12% ou 7% conforme origem
- Componentes importados (>40% conteúdo importado) → CFOP **3.101** | CST 00 | ICMS 4% (Res. Senado 13/2012)
- Compra para revenda (sem industrialização) → CFOP **1.102** / **2.102**
- Compra de fornecedor Simples Nacional ou MEI → CFOP 1.101 ou 1.102 | **sem crédito ICMS** (CST 60)

### SAÍDAS (Vendas de produção própria)
- Venda para SP → CFOP **5.101** | CST 00 | ICMS 12% (alíquota interna SP)
- Venda para Sul/Sudeste (exceto ES) → CFOP **6.101** | CST 00 | ICMS **12%**
- Venda para Norte/Nordeste/Centro-Oeste/ES → CFOP **6.101** | CST 00 | ICMS **7%**
- Venda para importador com mercadoria importada → CFOP **6.101** | CST 00 | ICMS **4%**

## SUAS FUNÇÕES
1. **Responder dúvidas** sobre classificação fiscal (CFOP, CST, alíquotas, base de cálculo)
2. **Aprender** novas regras — quando o usuário ensinar algo, SEMPRE salvar na base de conhecimento
3. **Simular** classificações de operações hipotéticas para tirar dúvidas
4. **Explicar** decisões passadas de classificação
5. **Orientar** sobre como registrar corretamente cada tipo de operação no ERP

## COMPORTAMENTO
- Foque nas operações da ND Implementos — não perca tempo explicando outros setores
- Quando o usuário disser "quando X, use Y" → salve isso como REGRA_EMPRESA na base
- Quando citar uma lei, inclua o artigo específico
- Se não tiver certeza do fundamento legal, diga claramente
- Use linguagem direta e prática — o usuário quer saber o que fazer, não uma aula de direito tributário
- Responda sempre em português brasileiro`;
}

@Injectable()
export class FiscalBrainChatService {
  private readonly logger = new Logger(FiscalBrainChatService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly classificador: ClassificadorService,
  ) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async enviarMensagem(companyId: string, mensagem: string) {
    // Salva mensagem do usuário
    await this.prisma.fiscalBrainChatMessage.create({
      data: { companyId, role: 'user', content: mensagem },
    });

    // Busca histórico recente (últimas 60 mensagens, para garantir contexto)
    const historico = await this.prisma.fiscalBrainChatMessage.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      take: 60,
      select: { role: true, content: true },
    });

    // Monta array de mensagens e garante alternância user→assistant
    // A Anthropic API exige que mensagens alternem obrigatoriamente
    const messagesRaw: Anthropic.MessageParam[] = historico.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Consolida mensagens consecutivas do mesmo role (junta em uma só)
    const messages: Anthropic.MessageParam[] = [];
    for (const msg of messagesRaw) {
      if (messages.length > 0 && messages[messages.length - 1].role === msg.role) {
        // Concatena com separador em vez de duplicar
        const last = messages[messages.length - 1];
        last.content = (last.content as string) + '\n\n' + (msg.content as string);
      } else {
        messages.push({ ...msg });
      }
    }

    // A API exige que o primeiro message seja 'user'
    while (messages.length > 0 && messages[0].role !== 'user') {
      messages.shift();
    }

    this.logger.log(`[Chat] Enviando ${messages.length} mensagens para o modelo (após normalização)`);

    // Loop agêntico com ferramentas
    const { text, toolsUsed } = await this.runAgenticLoop(companyId, messages);

    // Salva resposta do assistente
    await this.prisma.fiscalBrainChatMessage.create({
      data: {
        companyId,
        role: 'assistant',
        content: text,
        toolsUsed: toolsUsed.length > 0 ? (toolsUsed as any) : null,
      },
    });

    return {
      resposta: text,
      toolsUsed,
    };
  }

  private async runAgenticLoop(companyId: string, messages: Anthropic.MessageParam[]) {
    const toolsUsed: any[] = [];
    let currentMessages = [...messages];

    while (true) {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 2048,
        system: buildSystemPrompt(),
        messages: currentMessages,
        tools: FISCAL_BRAIN_TOOLS,
      });

      this.logger.log(`[Chat] stop_reason=${response.stop_reason} content_blocks=${response.content.length} types=${response.content.map(b => b.type).join(',')}`);

      if (response.stop_reason === 'end_turn') {
        const text = response.content
          .filter(b => b.type === 'text')
          .map(b => (b as Anthropic.TextBlock).text)
          .join('');
        this.logger.log(`[Chat] Resposta final: "${text.slice(0, 100)}..."`);
        return { text, toolsUsed };
      }

      if (response.stop_reason === 'tool_use') {
        currentMessages.push({ role: 'assistant', content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            this.logger.log(`[Chat] Executando ferramenta: ${block.name}`);
            const result = await this.executeTool(companyId, block.name, block.input as any);
            toolsUsed.push({ ferramenta: block.name, entrada: block.input, resultado: result });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }

        currentMessages.push({ role: 'user', content: toolResults });
      } else {
        // stop_reason inesperado — extrai o que tiver
        const text = response.content
          .filter(b => b.type === 'text')
          .map(b => (b as Anthropic.TextBlock).text)
          .join('') || 'Não foi possível processar sua mensagem.';
        return { text, toolsUsed };
      }
    }
  }

  private async executeTool(companyId: string, name: string, input: any): Promise<any> {
    try {
      switch (name) {
        case 'adicionar_legislacao':
          return this.toolAdicionarLegislacao(input);
        case 'buscar_base_conhecimento':
          return this.toolBuscarBase(input);
        case 'consultar_decisoes':
          return this.toolConsultarDecisoes(companyId, input);
        case 'classificar_operacao':
          return this.toolClassificarOperacao(companyId, input);
        default:
          return { erro: `Ferramenta desconhecida: ${name}` };
      }
    } catch (err: any) {
      this.logger.error(`[Chat] Erro na ferramenta ${name}: ${err.message}`);
      return { erro: err.message };
    }
  }

  private async toolAdicionarLegislacao(input: any) {
    const item = await this.prisma.legislacaoItem.create({
      data: {
        tipo: input.tipo,
        uf: input.uf ?? null,
        numero: input.numero,
        artigo: input.artigo ?? null,
        assunto: input.assunto,
        texto: input.texto,
        vigenciaInicio: input.vigenciaInicio ? new Date(input.vigenciaInicio) : new Date(),
        ativo: true,
      },
    });
    return {
      sucesso: true,
      id: item.id,
      mensagem: `✓ Regra "${input.assunto}" adicionada à base de conhecimento`,
    };
  }

  private async toolBuscarBase(input: any) {
    const uf = input.uf ?? 'SP';
    const result = await this.knowledgeBase.buscar({
      ufEmitente: uf,
      ufDestinatario: uf,
      ncms: [],
      palavrasChave: (input.query as string).split(' ').filter(Boolean),
    });
    const trechos = result.trechos;
    if (trechos.length === 0) return { total: 0, mensagem: 'Nenhuma regra encontrada para esse termo.' };
    return {
      total: trechos.length,
      items: trechos.map(i => ({
        numero: i.numero,
        artigo: i.artigo,
        assunto: i.assunto,
      })),
    };
  }

  private async toolConsultarDecisoes(companyId: string, input: any) {
    const where: any = { companyId };
    if (input.documentId) where.documentId = input.documentId;
    if (input.cfop) where.cfop = input.cfop;

    const decisions = await this.prisma.fiscalBrainDecision.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: input.limit ?? 5,
      select: {
        id: true,
        documentType: true,
        documentId: true,
        cfop: true,
        cstIcms: true,
        aliquotaIcms: true,
        confianca: true,
        autoAplicado: true,
        raciocinio: true,
        alertas: true,
        createdAt: true,
      },
    });

    if (decisions.length === 0) return { total: 0, mensagem: 'Nenhuma decisão encontrada.' };
    return { total: decisions.length, decisions };
  }

  private async toolClassificarOperacao(companyId: string, input: any) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxRegime: true },
    });

    const mapRegime = (r: string) =>
      r === 'SIMPLES_NACIONAL' ? 'SN' : r === 'LUCRO_PRESUMIDO' ? 'LP' : 'LR';

    const contexto: ContextoOperacao = {
      tipoOperacao: input.tipoOperacao,
      naturezaOperacao: input.naturezaOperacao ?? `${input.tipoOperacao === 'ENTRADA' ? 'Compra' : 'Venda'} de ${input.descricaoProduto ?? input.ncm}`,
      cnaeEmitente: input.tipoOperacao === 'ENTRADA' ? '4669999' : '2920400',
      regimeTributario: mapRegime(company?.taxRegime ?? 'LUCRO_REAL'),
      ufEmitente: input.ufOrigem,
      ufDestinatario: input.ufDestino,
      isIndustrial: input.tipoOperacao === 'SAIDA',
      isContribuinte: true,
      isConsumidorFinal: false,
      // Classificação do fornecedor fornecida pelo usuário na simulação
      ramoAtividadeFornecedor:    input.ramoAtividadeFornecedor   ?? undefined,
      naturezaJuridicaFornecedor: input.naturezaJuridicaFornecedor ?? undefined,
      taxRegimeFornecedor:        input.taxRegimeFornecedor        ?? undefined,
      produtos: [{
        ncm: input.ncm,
        descricao: input.descricaoProduto ?? input.ncm,
        valor: input.valor ?? 10000,
        quantidade: 1,
        unit: 'UN',
      }],
    };

    const c = await this.classificador.classificar(contexto);
    return {
      cfop: c.cfop,
      cstIcms: c.cstIcms,
      cstPis: c.cstPis,
      cstCofins: c.cstCofins,
      aliquotaIcms: c.aliquotaIcms,
      aliquotaPis: c.aliquotaPis,
      aliquotaCofins: c.aliquotaCofins,
      confianca: c.confianca,
      raciocinio: c.raciocinio,
      alertas: c.alertas,
    };
  }

  async historico(companyId: string, limit = 60) {
    return this.prisma.fiscalBrainChatMessage.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        role: true,
        content: true,
        toolsUsed: true,
        createdAt: true,
      },
    });
  }

  async limparSessao(companyId: string) {
    const { count } = await this.prisma.fiscalBrainChatMessage.deleteMany({
      where: { companyId },
    });
    return { sucesso: true, mensagensRemovidas: count };
  }
}
