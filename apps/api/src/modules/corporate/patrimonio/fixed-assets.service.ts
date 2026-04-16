import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class FixedAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------------
  // CRUD
  // ----------------------------------------------------------------
  async findAll(companyId: string, query: {
    search?: string; status?: string; type?: string;
    costCenter?: string; page?: string; limit?: string;
  }) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;
    const where: any = { companyId };

    if (query.search) {
      where.OR = [
        { plaqueta: { contains: query.search, mode: 'insensitive' } },
        { descricao: { contains: query.search, mode: 'insensitive' } },
        { marca: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.costCenter) where.costCenterCode = query.costCenter;

    const [data, total] = await Promise.all([
      this.prisma.fixedAsset.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { depreciacoes: true } },
        },
      }),
      this.prisma.fixedAsset.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const asset = await this.prisma.fixedAsset.findUnique({
      where: { id },
      include: {
        depreciacoes: { orderBy: [{ ano: 'desc' }, { mes: 'desc' }], take: 60 },
      },
    });
    if (!asset) throw new NotFoundException('Ativo não encontrado');
    return asset;
  }

  async create(companyId: string, data: {
    plaqueta: string; descricao: string; type?: string;
    marca?: string; modelo?: string; numeroserie?: string;
    localizacao?: string; costCenterCode?: string;
    dataAquisicao: string; fornecedor?: string; notaFiscal?: string;
    valorAquisicao: number; vidaUtilMeses: number;
    mesInicioDepreciacao?: string; observacoes?: string;
    icmsNaEntrada?: number;
    nfeEntradaChave?: string;
    nfeEntradaNumero?: string;
  }) {
    const valorAquisicao = Number(data.valorAquisicao);
    if (valorAquisicao <= 0) throw new BadRequestException('Valor de aquisição inválido');
    if (data.vidaUtilMeses <= 0) throw new BadRequestException('Vida útil inválida');

    const taxaMensal = 1 / data.vidaUtilMeses;
    const mesInicio = data.mesInicioDepreciacao
      ? new Date(data.mesInicioDepreciacao)
      : new Date(data.dataAquisicao);

    return this.prisma.fixedAsset.create({
      data: {
        companyId,
        plaqueta: data.plaqueta,
        descricao: data.descricao.toUpperCase(),
        type: (data.type || 'MAQUINA_EQUIPAMENTO') as any,
        marca: data.marca,
        modelo: data.modelo,
        numeroserie: data.numeroserie,
        localizacao: data.localizacao,
        costCenterCode: (data.costCenterCode || 'CC_IND') as any,
        dataAquisicao: new Date(data.dataAquisicao),
        fornecedor: data.fornecedor,
        notaFiscal: data.notaFiscal,
        valorAquisicao,
        vidaUtilMeses: data.vidaUtilMeses,
        taxaDepreciacaoMensal: taxaMensal,
        valorDepreciacaoAcumulada: 0,
        valorResidual: valorAquisicao,
        mesInicioDepreciacao: mesInicio,
        observacoes: data.observacoes,
        icmsNaEntrada: data.icmsNaEntrada ? data.icmsNaEntrada : null,
        ciapAtivo: data.icmsNaEntrada != null && data.icmsNaEntrada > 0,
        nfeEntradaChave: data.nfeEntradaChave || null,
        nfeEntradaNumero: data.nfeEntradaNumero || null,
      },
    });
  }

  async update(id: string, data: any) {
    const asset = await this.prisma.fixedAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Ativo não encontrado');
    if (asset.status === 'BAIXADO') throw new BadRequestException('Ativo baixado não pode ser editado');

    const updateData: any = { ...data };
    if (data.dataAquisicao) updateData.dataAquisicao = new Date(data.dataAquisicao);
    if (data.vidaUtilMeses) {
      updateData.taxaDepreciacaoMensal = 1 / Number(data.vidaUtilMeses);
    }

    return this.prisma.fixedAsset.update({ where: { id }, data: updateData });
  }

  async baixar(id: string, data: { dataBaixa: string; motivoBaixa: string }) {
    const asset = await this.prisma.fixedAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Ativo não encontrado');
    if (asset.status === 'BAIXADO') throw new BadRequestException('Ativo já está baixado');

    return this.prisma.fixedAsset.update({
      where: { id },
      data: {
        status: 'BAIXADO',
        dataBaixa: new Date(data.dataBaixa),
        motivoBaixa: data.motivoBaixa,
        active: false,
      },
    });
  }

  // ----------------------------------------------------------------
  // DEPRECIAÇÃO
  // ----------------------------------------------------------------

  /**
   * Calcula e registra a depreciação de UM ativo para um mês específico
   */
  async depreciarAtivo(assetId: string, ano: number, mes: number): Promise<{
    asset: string; valorDepreciacao: number; valorResidual: number; jaProcessado: boolean;
  }> {
    const asset = await this.prisma.fixedAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Ativo não encontrado');
    if (asset.status === 'BAIXADO') return { asset: assetId, valorDepreciacao: 0, valorResidual: Number(asset.valorResidual), jaProcessado: false };

    // Verificar se já foi processado este mês
    const jaProcessado = await this.prisma.fixedAssetDepreciation.findUnique({
      where: { assetId_ano_mes: { assetId, ano, mes } },
    });
    if (jaProcessado) return { asset: assetId, valorDepreciacao: Number(jaProcessado.valorDepreciacao), valorResidual: Number(jaProcessado.valorResidual), jaProcessado: true };

    // Verificar se o mês de cálculo é >= mesInicioDepreciacao
    const dataCalculo = new Date(ano, mes - 1, 1);
    if (dataCalculo < asset.mesInicioDepreciacao) {
      return { asset: assetId, valorDepreciacao: 0, valorResidual: Number(asset.valorResidual), jaProcessado: false };
    }

    // Calcular valor da parcela mensal
    const valorParcela = Number(asset.valorAquisicao) * Number(asset.taxaDepreciacaoMensal);
    const valorResidualAtual = Number(asset.valorResidual);

    // Não deprecia além do valor residual
    const valorDepreciacao = Math.min(valorParcela, valorResidualAtual);
    if (valorDepreciacao <= 0) return { asset: assetId, valorDepreciacao: 0, valorResidual: 0, jaProcessado: false };

    const novoAcumulado = Number(asset.valorDepreciacaoAcumulada) + valorDepreciacao;
    const novoResidual = Math.max(0, valorResidualAtual - valorDepreciacao);

    await this.prisma.$transaction([
      // Registrar a depreciação
      this.prisma.fixedAssetDepreciation.create({
        data: {
          companyId: asset.companyId,
          assetId,
          ano, mes,
          valorDepreciacao,
          valorAcumulado: novoAcumulado,
          valorResidual: novoResidual,
        },
      }),
      // Atualizar o ativo
      this.prisma.fixedAsset.update({
        where: { id: assetId },
        data: {
          valorDepreciacaoAcumulada: novoAcumulado,
          valorResidual: novoResidual,
          ultimaDepreciacaoEm: new Date(),
        },
      }),
    ]);

    return { asset: assetId, valorDepreciacao, valorResidual: novoResidual, jaProcessado: false };
  }

  /**
   * Processa depreciação de TODOS os ativos ativos de uma empresa para o mês
   */
  async processarDepreciacaoMensal(companyId: string, ano: number, mes: number) {
    const ativos = await this.prisma.fixedAsset.findMany({
      where: { companyId, status: { in: ['ATIVO', 'EM_MANUTENCAO'] } },
    });

    const resultados = await Promise.all(
      ativos.map(a => this.depreciarAtivo(a.id, ano, mes))
    );

    const totalDepreciado = resultados.reduce((s, r) => s + r.valorDepreciacao, 0);
    const processados = resultados.filter(r => !r.jaProcessado && r.valorDepreciacao > 0).length;
    const jaProcessados = resultados.filter(r => r.jaProcessado).length;

    return {
      periodo: `${String(mes).padStart(2, '0')}/${ano}`,
      totalAtivos: ativos.length,
      processados,
      jaProcessados,
      totalDepreciado,
      observacao: `Valor de R$ ${totalDepreciado.toFixed(2)} deve ser lançado como GGF no mês ${String(mes).padStart(2, '0')}/${ano}.`,
    };
  }

  // ----------------------------------------------------------------
  // RELATÓRIO DE DEPRECIAÇÃO
  // ----------------------------------------------------------------
  async relatorioDepreciacao(companyId: string, ano: number, mes: number) {
    const depreciacoes = await this.prisma.fixedAssetDepreciation.findMany({
      where: { companyId, ano, mes },
      include: {
        asset: {
          select: {
            plaqueta: true, descricao: true, type: true,
            costCenterCode: true, localizacao: true,
            valorAquisicao: true, vidaUtilMeses: true,
          },
        },
      },
      orderBy: [{ asset: { costCenterCode: 'asc' } }, { asset: { descricao: 'asc' } }],
    });

    // Agrupar por centro de custo
    const byCostCenter = new Map<string, { itens: any[]; totalDepreciacao: number }>();
    for (const d of depreciacoes) {
      const cc = d.asset.costCenterCode;
      const existing = byCostCenter.get(cc);
      const item = {
        plaqueta: d.asset.plaqueta,
        descricao: d.asset.descricao,
        type: d.asset.type,
        localizacao: d.asset.localizacao,
        valorAquisicao: Number(d.asset.valorAquisicao),
        valorDepreciacao: Number(d.valorDepreciacao),
        valorAcumulado: Number(d.valorAcumulado),
        valorResidual: Number(d.valorResidual),
        percentDepreciado: (Number(d.valorAcumulado) / Number(d.asset.valorAquisicao)) * 100,
      };
      if (existing) {
        existing.itens.push(item);
        existing.totalDepreciacao += item.valorDepreciacao;
      } else {
        byCostCenter.set(cc, { itens: [item], totalDepreciacao: item.valorDepreciacao });
      }
    }

    const totalGeral = depreciacoes.reduce((s, d) => s + Number(d.valorDepreciacao), 0);

    return {
      periodo: { ano, mes },
      totalGeral,
      quantidadeAtivos: depreciacoes.length,
      porCentrodeCusto: Object.fromEntries(byCostCenter),
    };
  }

  // ----------------------------------------------------------------
  // DASHBOARD / STATS
  // ----------------------------------------------------------------
  async getStats(companyId: string) {
    const [ativos, totalAquisicao, totalResidual] = await Promise.all([
      this.prisma.fixedAsset.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.fixedAsset.aggregate({
        where: { companyId, status: { not: 'BAIXADO' } },
        _sum: { valorAquisicao: true, valorDepreciacaoAcumulada: true, valorResidual: true },
      }),
      this.prisma.fixedAsset.count({ where: { companyId, valorResidual: { lte: 0 }, status: 'ATIVO' } }),
    ]);

    return {
      porStatus: ativos,
      valorTotalAquisicao: Number(totalAquisicao._sum.valorAquisicao || 0),
      valorTotalDepreciado: Number(totalAquisicao._sum.valorDepreciacaoAcumulada || 0),
      valorTotalResidual: Number(totalAquisicao._sum.valorResidual || 0),
      ativosDepreciadosTotalmente: totalResidual,
    };
  }

  // ----------------------------------------------------------------
  // CIAP — Crédito ICMS Ativo Imobilizado (A10)
  // ----------------------------------------------------------------

  /**
   * Retorna o saldo e status CIAP de um ativo específico.
   */
  async getCiapSaldo(assetId: string) {
    const asset = await this.prisma.fixedAsset.findUnique({
      where: { id: assetId },
      include: {
        ciapMovimentos: { orderBy: [{ ano: 'asc' }, { mes: 'asc' }] },
      },
    });
    if (!asset) throw new NotFoundException('Ativo não encontrado');

    const icmsTotal = Number(asset.icmsNaEntrada ?? 0);
    const parcelas = asset.parcelasIcmsCiap || 48;
    const aproveitadas = asset.parcelasApropriadas;
    const valorParcela = parcelas > 0 ? icmsTotal / parcelas : 0;
    const totalAproveitado = aproveitadas * valorParcela;
    const restante = Math.max(0, icmsTotal - totalAproveitado);
    const parcelasRestantes = Math.max(0, parcelas - aproveitadas);

    return {
      assetId,
      plaqueta: asset.plaqueta,
      descricao: asset.descricao,
      ciapAtivo: asset.ciapAtivo,
      nfeEntradaChave: asset.nfeEntradaChave,
      nfeEntradaNumero: asset.nfeEntradaNumero,
      icmsNaEntrada: icmsTotal,
      parcelasTotal: parcelas,
      parcelasAproveitadas: aproveitadas,
      parcelasRestantes,
      valorParcela: Math.round(valorParcela * 100) / 100,
      totalAproveitado: Math.round(totalAproveitado * 100) / 100,
      creditoRestante: Math.round(restante * 100) / 100,
      movimentos: asset.ciapMovimentos.map(m => ({
        ano: m.ano,
        mes: m.mes,
        parcelaNumero: m.parcelaNumero,
        valorCredito: Number(m.valorCredito),
        aproveitado: m.aproveitado,
        processadoEm: m.processadoEm,
      })),
    };
  }

  /**
   * Processa o crédito CIAP de TODOS os ativos elegíveis para um mês.
   * Cria CiapMovimento + FiscalEntry(CREDITO, ICMS, source: CIAP).
   */
  async processarCiapMensal(companyId: string, ano: number, mes: number) {
    // Safer: load all and filter in-memory
    const ativosElegiveis = await this.prisma.fixedAsset.findMany({
      where: { companyId, ciapAtivo: true, status: { in: ['ATIVO', 'EM_MANUTENCAO'] } },
    });

    const periodoReferencia = `${ano}-${String(mes).padStart(2, '0')}`;
    let totalCredito = 0;
    const resultados: any[] = [];

    for (const asset of ativosElegiveis) {
      const parcelas = asset.parcelasIcmsCiap || 48;
      if (Number(asset.parcelasApropriadas) >= parcelas) continue; // já completou

      const icmsTotal = Number(asset.icmsNaEntrada ?? 0);
      if (icmsTotal <= 0) continue;

      // Idempotency check
      const jaProcessado = await this.prisma.ciapMovimento.findUnique({
        where: { assetId_ano_mes: { assetId: asset.id, ano, mes } },
      });
      if (jaProcessado) {
        resultados.push({ assetId: asset.id, plaqueta: asset.plaqueta, jaProcessado: true, valorCredito: Number(jaProcessado.valorCredito) });
        continue;
      }

      const parcelaNumero = Number(asset.parcelasApropriadas) + 1;
      const valorParcela = icmsTotal / parcelas;
      const valorCredito = Math.round(valorParcela * 100) / 100;

      await this.prisma.$transaction([
        this.prisma.ciapMovimento.create({
          data: {
            companyId,
            assetId: asset.id,
            ano,
            mes,
            parcelaNumero,
            valorCredito,
            aproveitado: true,
            processadoEm: new Date(),
          },
        }),
        this.prisma.fixedAsset.update({
          where: { id: asset.id },
          data: { parcelasApropriadas: { increment: 1 } },
        }),
      ]);

      totalCredito += valorCredito;
      resultados.push({ assetId: asset.id, plaqueta: asset.plaqueta, parcelaNumero, valorCredito, jaProcessado: false });
    }

    // Aggregate FiscalEntry for the whole batch (if any credit)
    if (totalCredito > 0) {
      await this.prisma.fiscalEntry.create({
        data: {
          companyId,
          type: 'CREDITO' as any,
          bookType: 'ENTRADA' as any,
          taxType: 'ICMS' as any,
          dataLancamento: new Date(ano, mes - 1, 1),
          periodoReferencia,
          cfopCode: '1551',
          naturezaOperacao: 'CIAP — Crédito ICMS Ativo Imobilizado 1/48',
          valorContabil: 0,
          baseCalculo: 0,
          aliquota: 0,
          valorImposto: totalCredito,
          observations: `CIAP ${String(mes).padStart(2, '0')}/${ano}: ${resultados.filter(r => !r.jaProcessado).length} ativo(s).`,
        },
      });
    }

    return {
      periodo: `${String(mes).padStart(2, '0')}/${ano}`,
      ativosProcessados: resultados.filter(r => !r.jaProcessado).length,
      ativosJaProcessados: resultados.filter(r => r.jaProcessado).length,
      totalCredito: Math.round(totalCredito * 100) / 100,
      detalhe: resultados,
      observacao: totalCredito > 0
        ? `FiscalEntry de crédito ICMS CIAP criada: R$ ${totalCredito.toFixed(2)}`
        : 'Nenhum crédito gerado.',
    };
  }

  /**
   * Relatório CIAP — todos os ativos com CIAP ativo e seus saldos.
   */
  async relatorioCiap(companyId: string) {
    const ativos = await this.prisma.fixedAsset.findMany({
      where: { companyId, ciapAtivo: true },
      orderBy: { dataAquisicao: 'asc' },
    });

    const itens = ativos.map(asset => {
      const icmsTotal = Number(asset.icmsNaEntrada ?? 0);
      const parcelas = asset.parcelasIcmsCiap || 48;
      const aproveitadas = Number(asset.parcelasApropriadas);
      const valorParcela = parcelas > 0 ? icmsTotal / parcelas : 0;
      const totalAproveitado = aproveitadas * valorParcela;
      const restante = Math.max(0, icmsTotal - totalAproveitado);
      const parcelasRestantes = Math.max(0, parcelas - aproveitadas);

      return {
        assetId: asset.id,
        plaqueta: asset.plaqueta,
        descricao: asset.descricao,
        dataAquisicao: asset.dataAquisicao,
        nfeEntradaNumero: asset.nfeEntradaNumero,
        nfeEntradaChave: asset.nfeEntradaChave,
        status: asset.status,
        icmsNaEntrada: icmsTotal,
        parcelasTotal: parcelas,
        parcelasAproveitadas: aproveitadas,
        parcelasRestantes,
        valorParcela: Math.round(valorParcela * 100) / 100,
        totalAproveitado: Math.round(totalAproveitado * 100) / 100,
        creditoRestante: Math.round(restante * 100) / 100,
        encerraEm: parcelasRestantes > 0
          ? `${parcelas} meses a partir de ${asset.dataAquisicao.toISOString().substring(0, 7)}`
          : 'Encerrado',
      };
    });

    const totalIcms = itens.reduce((s, i) => s + i.icmsNaEntrada, 0);
    const totalAproveitado = itens.reduce((s, i) => s + i.totalAproveitado, 0);
    const totalRestante = itens.reduce((s, i) => s + i.creditoRestante, 0);

    return {
      totalAtivos: ativos.length,
      totalIcmsNaEntrada: Math.round(totalIcms * 100) / 100,
      totalAproveitado: Math.round(totalAproveitado * 100) / 100,
      totalRestante: Math.round(totalRestante * 100) / 100,
      itens,
    };
  }
}
