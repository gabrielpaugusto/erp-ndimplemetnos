import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type DeclaracaoStatus = 'PENDENTE' | 'RECEBIDA' | 'ARQUIVADA' | 'CANCELADA';

export interface ItemDeclaracao {
  ncm:        string;
  descricao:  string;
  cfop:       string;
  quantidade: number;
  unit:       string;
  valorItem:  number;
}

export interface DeclaracaoArt264Result {
  id:                   string;
  nfeId:                string;
  status:               DeclaracaoStatus;
  compradorRazaoSocial: string;
  compradorCnpj:        string;
  conteudo:             string;
  infCplSugerido:       string;
  itens:                ItemDeclaracao[];
  geradoPorPipeline:    boolean;
  dataGeracao:          Date;
  dataRecebimento:      Date | null;
  dataArquivamento:     Date | null;
  anexoUrl:             string | null;
  observacoes:          string | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Etapa 6 — Declaração Art. 264, I, RICMS-SP
 *
 * Quando o Pipeline Saída detecta que a operação está ISENTA de ST por
 * industrialização (Art. 264, I), o emitente DEVE exigir uma declaração
 * escrita do comprador confirmando a destinação.
 *
 * Este service:
 *  1. Gera o texto completo da declaração (conteudo) e o infCpl da NF-e.
 *  2. Persiste um registro DeclaracaoArt264 com status PENDENTE.
 *  3. Atualiza o campo informacoesComplementares da NFeDocument.
 *  4. Permite marcar a declaração como RECEBIDA (física) ou ARQUIVADA (com upload).
 *  5. Lista declarações com filtros de status/período para controle interno.
 *
 * Base legal:
 *  - Art. 264, inciso I, RICMS-SP (Decreto 45.490/2000)
 *  - Art. 264, § 2º — responsabilidade do declarante
 *  - Art. 202 RICMS-SP — conservação 5 anos
 */
@Injectable()
export class DeclaracaoArt264Service {
  private readonly logger = new Logger(DeclaracaoArt264Service.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Geração ───────────────────────────────────────────────────────────────

  /**
   * Gera (ou retorna existente) a declaração Art. 264 I para uma NF-e.
   *
   * Idempotente: se já existe declaração PENDENTE para a NF-e, retorna ela
   * sem criar duplicata.
   *
   * @param nfeId             ID da NFeDocument de saída
   * @param companyId         ID da empresa emitente
   * @param geradoPorPipeline true quando chamado automaticamente pelo Pipeline Saída
   */
  async gerarDeclaracao(
    nfeId: string,
    companyId: string,
    geradoPorPipeline = false,
  ): Promise<DeclaracaoArt264Result> {

    // ── Idempotência ─────────────────────────────────────────────────────────
    const existente = await this.prisma.declaracaoArt264.findFirst({
      where: { nfeId, companyId, status: { in: ['PENDENTE', 'RECEBIDA', 'ARQUIVADA'] } },
    });
    if (existente) {
      this.logger.debug(`[DeclaracaoArt264] Reutilizando declaração ${existente.id} para NF-e ${nfeId}`);
      return this.toResult(existente);
    }

    // ── Busca dados da NF-e ──────────────────────────────────────────────────
    const nfe = await this.prisma.nFeDocument.findFirst({
      where: { id: nfeId, companyId },
      include: {
        items: {
          select: {
            ncmCode: true, description: true, cfopCode: true,
            quantity: true, unit: true, unitPrice: true,
            cstIcms: true,
          },
          orderBy: { itemNumber: 'asc' },
        },
        person: {
          include: {
            addresses: { take: 1, orderBy: { principal: 'desc' } },
          },
        },
      },
    });

    if (!nfe) {
      throw new NotFoundException(`NFeDocument ${nfeId} não encontrada para a empresa ${companyId}`);
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        razaoSocial: true, cnpj: true, inscricaoEstadual: true,
        logradouro: true, numero: true, bairro: true, municipio: true, uf: true,
      },
    });

    if (!company) throw new NotFoundException('Empresa não encontrada');

    const person = nfe.person;
    if (!person) throw new BadRequestException('NF-e sem destinatário vinculado');

    const addr = (person as any).addresses?.[0];
    const enderecoComprador = addr
      ? `${addr.logradouro ?? ''}, ${addr.numero ?? ''} — ${addr.bairro ?? ''}, ${addr.municipio ?? ''}-${addr.uf ?? ''}`
      : '';

    // ── Monta lista de itens ─────────────────────────────────────────────────
    // Inclui todos os itens (declaração cobre a NF-e inteira)
    const itens: ItemDeclaracao[] = nfe.items.map(it => ({
      ncm:        it.ncmCode   || '',
      descricao:  it.description,
      cfop:       it.cfopCode  || '',
      quantidade: Number(it.quantity),
      unit:       it.unit || 'UN',
      valorItem:  Number(it.unitPrice) * Number(it.quantity),
    }));

    // ── Gera os textos ───────────────────────────────────────────────────────
    const compradorRazaoSocial = person.razaoSocial;
    const compradorCnpj        = person.cpfCnpj || '';
    const compradorIe          = (person as any).rgIe || '';
    const nfeNumero            = nfe.numero ? String(nfe.numero) : '(rascunho)';
    const nfeSerie             = String((nfe as any).serie ?? 1);
    const dataEmissao          = nfe.dataEmissao
      ? this.formatDataPorExtenso(nfe.dataEmissao)
      : 'data de emissão';

    const conteudo   = this.gerarTextoDeclaracao({
      compradorRazaoSocial, compradorCnpj, compradorIe,
      enderecoComprador,
      emitenteRazaoSocial: company.razaoSocial,
      emitenteCnpj:        company.cnpj,
      nfeNumero, nfeSerie, dataEmissao,
      municipioEmitente:   company.municipio || 'São Paulo',
      ufEmitente:          company.uf || 'SP',
      itens,
    });

    const infCplSugerido = this.gerarInfCpl(nfeNumero, nfeSerie);

    // ── Persiste ─────────────────────────────────────────────────────────────
    const declaracao = await this.prisma.declaracaoArt264.create({
      data: {
        companyId,
        nfeId,
        personId:             person.id,
        compradorRazaoSocial,
        compradorCnpj,
        compradorIe,
        compradorEndereco:    enderecoComprador,
        status:               'PENDENTE',
        conteudo,
        itensJson:            itens as any,
        infCplSugerido,
        geradoPorPipeline,
      },
    });

    // ── Atualiza informacoesComplementares da NF-e ───────────────────────────
    // Só define se ainda não há texto (não sobrescreve dados já preenchidos)
    if (!nfe.informacoesComplementares) {
      await this.prisma.nFeDocument.update({
        where: { id: nfeId },
        data:  { informacoesComplementares: infCplSugerido },
      });
    }

    this.logger.log(
      `[DeclaracaoArt264] Declaração ${declaracao.id} gerada para NF-e ${nfeNumero}/${nfeSerie} ` +
      `| Comprador: ${compradorRazaoSocial} | Pipeline: ${geradoPorPipeline}`,
    );

    return this.toResult(declaracao);
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  async marcarRecebida(
    declaracaoId: string,
    companyId: string,
    observacoes?: string,
  ): Promise<DeclaracaoArt264Result> {
    const declaracao = await this.findOrFail(declaracaoId, companyId);

    if (declaracao.status === 'ARQUIVADA') {
      throw new BadRequestException('Declaração já arquivada — não é possível reverter para RECEBIDA.');
    }
    if (declaracao.status === 'CANCELADA') {
      throw new BadRequestException('Declaração cancelada — não é possível marcar como recebida.');
    }

    const updated = await this.prisma.declaracaoArt264.update({
      where: { id: declaracaoId },
      data: {
        status:          'RECEBIDA',
        dataRecebimento: new Date(),
        observacoes:     observacoes ?? declaracao.observacoes,
      },
    });

    this.logger.log(`[DeclaracaoArt264] ${declaracaoId} marcada como RECEBIDA`);
    return this.toResult(updated);
  }

  async arquivar(
    declaracaoId: string,
    companyId: string,
    anexoUrl?: string,
    observacoes?: string,
  ): Promise<DeclaracaoArt264Result> {
    const declaracao = await this.findOrFail(declaracaoId, companyId);

    if (declaracao.status === 'CANCELADA') {
      throw new BadRequestException('Declaração cancelada — não é possível arquivar.');
    }

    const updated = await this.prisma.declaracaoArt264.update({
      where: { id: declaracaoId },
      data: {
        status:           'ARQUIVADA',
        dataArquivamento: new Date(),
        dataRecebimento:  declaracao.dataRecebimento ?? new Date(),
        anexoUrl:         anexoUrl ?? declaracao.anexoUrl,
        observacoes:      observacoes ?? declaracao.observacoes,
      },
    });

    this.logger.log(`[DeclaracaoArt264] ${declaracaoId} arquivada${anexoUrl ? ` com anexo` : ''}`);
    return this.toResult(updated);
  }

  async cancelar(
    declaracaoId: string,
    companyId: string,
    motivo: string,
  ): Promise<DeclaracaoArt264Result> {
    const declaracao = await this.findOrFail(declaracaoId, companyId);

    if (declaracao.status === 'ARQUIVADA') {
      throw new BadRequestException('Declaração arquivada não pode ser cancelada.');
    }

    const updated = await this.prisma.declaracaoArt264.update({
      where: { id: declaracaoId },
      data: {
        status:      'CANCELADA',
        observacoes: motivo,
      },
    });

    return this.toResult(updated);
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async listar(
    companyId: string,
    query: {
      status?:    string;
      page?:      string;
      limit?:     string;
      search?:    string;
    },
  ) {
    const page  = parseInt(query.page  ?? '1');
    const limit = parseInt(query.limit ?? '20');
    const where: any = { companyId };

    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { compradorRazaoSocial: { contains: query.search, mode: 'insensitive' } },
        { compradorCnpj: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.declaracaoArt264.findMany({
        where,
        orderBy:  { createdAt: 'desc' },
        skip:     (page - 1) * limit,
        take:     limit,
        select: {
          id: true, nfeId: true, status: true,
          compradorRazaoSocial: true, compradorCnpj: true,
          dataGeracao: true, dataRecebimento: true, dataArquivamento: true,
          geradoPorPipeline: true, anexoUrl: true,
          nfe: { select: { numero: true, serie: true, dataEmissao: true } },
        },
      }),
      this.prisma.declaracaoArt264.count({ where }),
    ]);

    // Estatísticas de conformidade (útil para painel fiscal)
    const stats = await this.prisma.declaracaoArt264.groupBy({
      by:    ['status'],
      where: { companyId },
      _count: { id: true },
    });

    return {
      data,
      meta:  { total, page, limit, totalPages: Math.ceil(total / limit) },
      stats: Object.fromEntries(stats.map(s => [s.status, s._count.id])),
    };
  }

  async buscarPorNfe(nfeId: string, companyId: string) {
    return this.prisma.declaracaoArt264.findFirst({
      where: { nfeId, companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async buscarPorId(declaracaoId: string, companyId: string) {
    return this.findOrFail(declaracaoId, companyId);
  }

  // ── Geração do texto ──────────────────────────────────────────────────────

  private gerarTextoDeclaracao(params: {
    compradorRazaoSocial: string;
    compradorCnpj:        string;
    compradorIe:          string;
    enderecoComprador:    string;
    emitenteRazaoSocial:  string;
    emitenteCnpj:         string;
    nfeNumero:            string;
    nfeSerie:             string;
    dataEmissao:          string;
    municipioEmitente:    string;
    ufEmitente:           string;
    itens:                ItemDeclaracao[];
  }): string {
    const {
      compradorRazaoSocial, compradorCnpj, compradorIe,
      enderecoComprador,
      emitenteRazaoSocial, emitenteCnpj,
      nfeNumero, nfeSerie, dataEmissao,
      municipioEmitente, ufEmitente,
      itens,
    } = params;

    const cnpjFormatado = this.formatCnpj(compradorCnpj);
    const cnpjEmitenteFormatado = this.formatCnpj(emitenteCnpj);

    const listaItens = itens.map((it, i) => {
      const num = String(i + 1).padStart(2, '0');
      const qtd = it.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
      const val = it.valorItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      return `  ${num}. ${it.descricao} | NCM: ${it.ncm} | CFOP: ${it.cfop} | Qtd: ${qtd} ${it.unit} | Valor: ${val}`;
    }).join('\n');

    const dataAtual = this.formatDataPorExtenso(new Date());

    return `
DECLARAÇÃO PARA FINS DE NÃO RETENÇÃO DO ICMS POR SUBSTITUIÇÃO TRIBUTÁRIA
Art. 264, inciso I, do Regulamento do ICMS/SP — Decreto nº 45.490, de 30.11.2000

Eu/Nós, ${compradorRazaoSocial.toUpperCase()}, pessoa jurídica de direito privado,
inscrita no CNPJ/MF sob o nº ${cnpjFormatado}${compradorIe ? `, e IE nº ${compradorIe}` : ''},
${enderecoComprador ? `com sede em ${enderecoComprador},` : ''}

DECLARAMOS, para os devidos efeitos fiscais, nos termos do art. 264, inciso I, do
Regulamento do ICMS do Estado de São Paulo (Decreto nº 45.490, de 30 de novembro
de 2000), que as mercadorias abaixo descritas, constantes da NF-e nº ${nfeNumero},
série ${nfeSerie}, emitida por ${emitenteRazaoSocial.toUpperCase()} (CNPJ ${cnpjEmitenteFormatado})
em ${dataEmissao}, serão utilizadas DIRETAMENTE em processo de INDUSTRIALIZAÇÃO
realizado em nosso estabelecimento, não estando sujeitas, portanto, ao regime de
substituição tributária do ICMS, conforme referido dispositivo legal.

DESCRIÇÃO DAS MERCADORIAS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${listaItens}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Declaramos ainda que:

1. As mercadorias acima serão utilizadas diretamente no processo de industrialização
   desenvolvido em nosso estabelecimento, integrando-se ao produto final ou sendo
   consumidas no referido processo, nos termos do art. 264, I, RICMS-SP.

2. Assumimos inteira responsabilidade civil, criminal e tributária por esta declaração,
   nos termos do art. 264, § 2º, do RICMS/SP, respondendo pelos tributos, juros e
   multas que forem devidos caso a mercadoria tenha destinação diversa da declarada.

3. Esta declaração deverá ser conservada pelo emitente da NF-e e pelo declarante
   pelo prazo de 5 (cinco) anos, nos termos do art. 202 do RICMS/SP, para exibição
   ao Fisco quando solicitada.

${municipioEmitente}-${ufEmitente}, ${dataAtual}

_____________________________________________        ____________________
Assinatura do Responsável                            Data de assinatura

Nome: _______________________________________________

Cargo/Função: _______________________________________

CPF do signatário: __________________________________

${compradorRazaoSocial}
CNPJ: ${cnpjFormatado}
`.trim();
  }

  /**
   * Gera o texto curto para o campo <infCpl> da NF-e (campo informacoesComplementares).
   * Máximo recomendado: 2.000 caracteres conforme NT 2020.006.
   */
  gerarInfCpl(nfeNumero: string, nfeSerie: string): string {
    return (
      `Operação não sujeita ao regime de substituição tributária do ICMS — ` +
      `Art. 264, inciso I, do RICMS/SP (Decreto nº 45.490/2000) — ` +
      `Mercadoria destinada à integração em processo de industrialização ` +
      `pelo destinatário. Declaração de destinação emitida e arquivada nos ` +
      `termos do art. 264, § 2º, e art. 202 do RICMS/SP. ` +
      `NF-e nº ${nfeNumero} / Série ${nfeSerie}.`
    );
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  private async findOrFail(id: string, companyId: string) {
    const dec = await this.prisma.declaracaoArt264.findFirst({
      where: { id, companyId },
    });
    if (!dec) {
      throw new NotFoundException(`DeclaracaoArt264 ${id} não encontrada`);
    }
    return dec;
  }

  private toResult(dec: any): DeclaracaoArt264Result {
    return {
      id:                   dec.id,
      nfeId:                dec.nfeId,
      status:               dec.status as DeclaracaoStatus,
      compradorRazaoSocial: dec.compradorRazaoSocial,
      compradorCnpj:        dec.compradorCnpj,
      conteudo:             dec.conteudo,
      infCplSugerido:       dec.infCplSugerido,
      itens:                Array.isArray(dec.itensJson) ? dec.itensJson as ItemDeclaracao[] : [],
      geradoPorPipeline:    dec.geradoPorPipeline,
      dataGeracao:          dec.dataGeracao,
      dataRecebimento:      dec.dataRecebimento ?? null,
      dataArquivamento:     dec.dataArquivamento ?? null,
      anexoUrl:             dec.anexoUrl ?? null,
      observacoes:          dec.observacoes ?? null,
    };
  }

  private formatCnpj(cnpj: string): string {
    const c = cnpj.replace(/\D/g, '');
    if (c.length !== 14) return cnpj;
    return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12,14)}`;
  }

  private formatDataPorExtenso(date: Date): string {
    const meses = [
      'janeiro','fevereiro','março','abril','maio','junho',
      'julho','agosto','setembro','outubro','novembro','dezembro',
    ];
    return `${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
  }
}
