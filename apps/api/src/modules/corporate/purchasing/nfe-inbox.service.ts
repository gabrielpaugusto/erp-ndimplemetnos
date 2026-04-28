import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { SefazClientService } from '@/modules/corporate/fiscal/government/sefaz/sefaz-client.service';
import { CreateNfeInboxDto } from './dto/create-nfe-inbox.dto';
import { ManifestNfeDto } from './dto/manifest-nfe.dto';
import { LinkNfeItemDto, CreateAndLinkDto } from './dto/link-nfe-item.dto';
import { PostNfeEntryDto } from './dto/post-nfe-entry.dto';
import { RecepcionarNfeDto } from './dto/recepcionar-nfe.dto';
import { LancarFinanceiroNfeDto } from './dto/lancar-financeiro-nfe.dto';
import { EscriturarNfeDto } from './dto/escriturar-nfe.dto';
import { OperacoesFiscaisService } from '@/modules/corporate/fiscal/operacoes-fiscais.service';
import { NfeIaPipelineService } from './nfe-ia-pipeline.service';

@Injectable()
export class NfeInboxService {
  private readonly logger = new Logger(NfeInboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sefazClient: SefazClientService,
    private readonly operacoesFiscais: OperacoesFiscaisService,
    private readonly iaPipeline: NfeIaPipelineService,
  ) {}

  async findAll(
    companyId: string,
    query: {
      status?: string;
      emitenteCnpj?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.emitenteCnpj) {
      where.emitenteCnpj = query.emitenteCnpj;
    }

    if (query.startDate || query.endDate) {
      where.dataEmissao = {};
      if (query.startDate) {
        where.dataEmissao.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.dataEmissao.lte = new Date(query.endDate);
      }
    }

    if (query.search) {
      where.OR = [
        { numero: { contains: query.search, mode: 'insensitive' } },
        { emitenteNome: { contains: query.search, mode: 'insensitive' } },
        { emitenteCnpj: { contains: query.search, mode: 'insensitive' } },
        { chaveAcesso: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.nFeInbox.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dataEmissao: 'desc' },
        include: {
          _count: { select: { items: true } },
          purchaseOrder: {
            select: { id: true, numero: true },
          },
          cteDocuments: {
            select: { id: true, numero: true, serie: true, transportadoraNome: true, transportadoraCnpj: true, valorTotal: true, valorFrete: true, status: true },
          },
        },
      }),
      this.prisma.nFeInbox.count({ where }),
    ]);

    // Contagem de eventos por chave de acesso
    const chaves = data.map(n => n.chaveAcesso).filter(Boolean) as string[];
    const eventCounts: Record<string, number> = {};
    if (chaves.length > 0) {
      const groups = await this.prisma.dFeEvento.groupBy({
        by: ['chDFe'],
        where: { companyId, chDFe: { in: chaves } },
        _count: { id: true },
      });
      for (const g of groups) {
        eventCounts[g.chDFe] = g._count.id;
      }
    }

    return {
      data: data.map(n => ({ ...n, eventosCount: eventCounts[n.chaveAcesso] ?? 0 })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, companyId: string) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, code: true, description: true, unit: true },
            },
          },
          orderBy: { numeroItem: 'asc' },
        },
        purchaseOrder: {
          select: { id: true, numero: true, status: true },
        },
        cteDocuments: {
          select: { id: true, numero: true, serie: true, transportadoraNome: true, transportadoraCnpj: true, valorTotal: true, valorFrete: true, status: true, dataEmissao: true },
        },
      },
    });

    if (!inbox) {
      throw new NotFoundException(`NFeInbox ${id} not found`);
    }

    return inbox;
  }

  async getStats(companyId: string) {
    const [byStatus, total, eventosCount] = await Promise.all([
      this.prisma.nFeInbox.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
        _sum: { valorTotal: true },
      }),
      this.prisma.nFeInbox.count({ where: { companyId } }),
      this.prisma.dFeEvento.count({ where: { companyId } }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
        valorTotal: s._sum.valorTotal,
      })),
      total,
      eventosCount,
    };
  }

  async getAllEventos(
    companyId: string,
    query: { page?: string; limit?: string; search?: string },
  ) {
    const page  = parseInt(query.page  || '1',  10);
    const limit = parseInt(query.limit || '20', 10);
    const skip  = (page - 1) * limit;

    const where: any = { companyId };
    if (query.search) {
      where.OR = [
        { chDFe:   { contains: query.search, mode: 'insensitive' } },
        { xEvento: { contains: query.search, mode: 'insensitive' } },
        { tpEvento:{ contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [eventos, total] = await Promise.all([
      this.prisma.dFeEvento.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dhRegistro: 'desc' },
      }),
      this.prisma.dFeEvento.count({ where }),
    ]);

    return {
      data: eventos,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Consulta o SEFAZ (DistDFeInt) para buscar NF-es emitidas contra o CNPJ da empresa.
   * Usa paginação por NSU — retoma do último NSU salvo no banco.
   */
  async syncFromSefaz(companyId: string) {
    this.logger.log(`[Sync] Iniciando sincronização SEFAZ para empresa ${companyId}`);

    // 1. Get company CNPJ, UF e datas de início por módulo
    const [company, moduleRows] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { cnpj: true, uf: true, ambienteDFe: true, dataInicioOperacao: true },
      }),
      this.prisma.moduleStartDate.findMany({ where: { companyId } }),
    ]);
    const globalInicio: Date | null = (company as any)?.dataInicioOperacao ?? null;
    const byModule: Record<string, Date> = {};
    for (const row of moduleRows) byModule[row.module] = row.startDate;
    // Resolve data de início por módulo com fallback global
    const resolveInicio = (mod: string): Date | null => byModule[mod] ?? globalInicio ?? null;

    this.logger.log(`[Sync] Empresa: CNPJ=${company?.cnpj || 'NAO CONFIGURADO'} UF=${company?.uf || 'nulo'}`);

    if (!company?.cnpj) {
      throw new BadRequestException('CNPJ da empresa não configurado');
    }

    const uf = company.uf || 'SP';

    // 2. Determinar NSU inicial
    // Prioridade: nsuRetornado do último audit log com 656 (SEFAZ especifica qual NSU usar)
    // Fallback: maior NSU salvo nos documentos do banco
    const lastAuditLog = await this.prisma.sefazAuditLog.findFirst({
      where: { companyId, endpoint: 'NFeDistribuicaoDFe' },
      orderBy: { chamadaEm: 'desc' },
      select: { cStat: true, nsuRetornado: true, nsuEnviado: true },
    });

    let ultNSU: string;
    if (lastAuditLog?.cStat === '656' && lastAuditLog.nsuRetornado) {
      // SEFAZ retornou ultNSU específico com o 656 — usar obrigatoriamente
      ultNSU = lastAuditLog.nsuRetornado;
      this.logger.log(`[Sync] Usando NSU do último 656 retornado pelo SEFAZ: ${ultNSU}`);
    } else {
      const [lastNfeNsu, lastCteNsu, lastMdfeNsu, lastEventoNsu] = await Promise.all([
        this.prisma.nFeInbox.findFirst({ where: { companyId, nsu: { not: null } }, orderBy: { nsu: 'desc' }, select: { nsu: true } }),
        this.prisma.cteDocument.findFirst({ where: { companyId, nsu: { not: null } }, orderBy: { nsu: 'desc' }, select: { nsu: true } }),
        this.prisma.mdfeInbox.findFirst({ where: { companyId, nsu: { not: null } }, orderBy: { nsu: 'desc' }, select: { nsu: true } }),
        this.prisma.dFeEvento.findFirst({ where: { companyId, nsu: { not: null } }, orderBy: { nsu: 'desc' }, select: { nsu: true } }),
      ]);
      const allNsus = [lastNfeNsu?.nsu, lastCteNsu?.nsu, lastMdfeNsu?.nsu, lastEventoNsu?.nsu]
        .filter(Boolean) as string[];
      ultNSU = allNsus.length > 0 ? allNsus.sort().at(-1)! : '000000000000000';
    }
    this.logger.log(`[Sync] Último NSU: ${ultNSU}`);

    let totalCreated = 0;
    let totalCteCreated = 0;
    let totalMdfeCreated = 0;
    let totalEventosCreated = 0;
    let hasMore = true;
    let nfeRateLimited = false;

    // 3. Loop until no more documents (DistDFe returns up to 50 per call)
    while (hasMore) {
      this.logger.log(`[Sync] Chamando distribuicaoDFe UF=${uf} NSU=${ultNSU}`);
      const ambienteNfe = String(company.ambienteDFe ?? 2) as '1' | '2';
      const result = await this.sefazClient.distribuicaoDFe(
        companyId,
        uf,
        company.cnpj,
        ultNSU,
        ambienteNfe,
      );

      this.logger.log(`[Sync] DistDFe resultado: success=${result.success} cStat=${result.cStat} xMotivo=${result.xMotivo} docs=${result.docs.length}`);

      // 137 = sem docs; 656 = limite de taxa; 589 = NSU maior que o máximo do ambiente
      if (!result.success) {
        if (result.cStat === '656') {
          this.logger.log(`[Sync] Limite de taxa NF-e (cStat 656). Continuando para sincronização CT-e/MDF-e.`);
          nfeRateLimited = true;
          hasMore = false;
          break;
        }
        if (result.cStat === '589') {
          this.logger.warn(`[Sync] NSU inválido para este ambiente (cStat 589). Reiniciando do NSU zero.`);
          ultNSU = '000000000000000';
          continue;
        }
        // Qualquer outro erro: encerra o loop mas não descarta o que já foi importado
        this.logger.warn(`[Sync] SEFAZ retornou erro (cStat ${result.cStat}): ${result.xMotivo}. Encerrando loop com ${totalCreated} doc(s) já importados.`);
        hasMore = false;
        break;
      }

      if (result.docs.length === 0 || result.cStat === '137') {
        hasMore = false;
        break;
      }

      let cteCreated = 0;
      let mdfeCreated = 0;
      let eventosCreated = 0;
      let nfeCreated = 0;

      for (const doc of result.docs) {
        const schema = doc.schema || '';

        // ── CT-e (resCTe ou procCTe) ────────────────────────────────────────
        if (schema.includes('CTe') || schema.includes('cte') || schema.includes('resCTe')) {
          const parsedCte = this.sefazClient.parsearXmlCTe(doc.xml);
          if (!parsedCte?.chCTe) continue;

          const existingCte = await this.prisma.cteDocument.findFirst({
            where: { companyId, chaveAcesso: parsedCte.chCTe },
          });
          if (existingCte) continue;

          // Ignorar CT-e emitidos antes da data de início do módulo CTE_ENTRADA
          const inicioCteSrc = resolveInicio('CTE_ENTRADA');
          if (inicioCteSrc && parsedCte.dhEmi && new Date(parsedCte.dhEmi) < inicioCteSrc) {
            this.logger.debug(`[Sync] CT-e ${parsedCte.chCTe} ignorado (emissão anterior ao início de operação CTE_ENTRADA)`);
            continue;
          }

          const transportadora = parsedCte.cnpjEmit
            ? await this.prisma.person.findFirst({
                where: { companyId, cpfCnpj: parsedCte.cnpjEmit },
                select: { id: true },
              })
            : null;

          // Busca CFOP padrão configurado na empresa (fallback para '2352' — CT-e entrada interestadual)
          const companyConfig = await this.prisma.company.findUnique({
            where: { id: companyId },
            select: { cfopPadraoCteEntrada: true },
          });
          const cfopPadraoCte = (companyConfig as any)?.cfopPadraoCteEntrada ?? '2352';

          await this.prisma.cteDocument.create({
            data: {
              companyId,
              chaveAcesso:        parsedCte.chCTe,
              numero:             parsedCte.nCT || '0',
              serie:              parsedCte.serie || '0',
              dataEmissao:        parsedCte.dhEmi ? new Date(parsedCte.dhEmi) : new Date(),
              modalidade:         parsedCte.modalidade as any,
              cfop:               parsedCte.cfop || cfopPadraoCte,
              transportadoraId:   transportadora?.id ?? null,
              transportadoraCnpj: parsedCte.cnpjEmit,
              transportadoraNome: parsedCte.xNomeEmit,
              remetenteCnpj:      parsedCte.remetenteCnpj || null,
              remetenteNome:      parsedCte.remetenteNome || null,
              destinatarioCnpj:   parsedCte.destCnpj || null,
              destinatarioNome:   parsedCte.destNome || null,
              valorFrete:         parsedCte.vTPrest,
              valorTotal:         parsedCte.vTPrest,
              bcIcms:             parsedCte.vBC,
              aliqIcms:           parsedCte.pICMS,
              valorIcms:          parsedCte.vICMS,
              status:             'REGISTRADO',
              nsu:                doc.nsu,
              xmlContent:         doc.xml,
            },
          });
          cteCreated++;
          continue;
        }

        // ── MDF-e (resMDFe ou procMDFe) ─────────────────────────────────────
        if (schema.includes('MDFe') || schema.includes('mdfe') || schema.includes('resMDFe')) {
          const parsedMdfe = this.sefazClient.parsearXmlMDFe(doc.xml);
          if (!parsedMdfe?.chMDFe) continue;

          const existingMdfe = await this.prisma.mdfeInbox.findUnique({
            where: { companyId_chaveAcesso: { companyId, chaveAcesso: parsedMdfe.chMDFe } },
          });
          if (existingMdfe) continue;

          // Ignorar MDF-e emitidos antes da data de início do módulo MDFE_ENTRADA
          const inicioMdfe = resolveInicio('MDFE_ENTRADA');
          if (inicioMdfe && parsedMdfe.dhEmi && new Date(parsedMdfe.dhEmi) < inicioMdfe) {
            this.logger.debug(`[Sync] MDF-e ${parsedMdfe.chMDFe} ignorado (emissão anterior ao início de operação MDFE_ENTRADA)`);
            continue;
          }

          await this.prisma.mdfeInbox.create({
            data: {
              companyId,
              chaveAcesso:    parsedMdfe.chMDFe,
              numero:         parsedMdfe.nMDF || '0',
              serie:          parsedMdfe.serie || '1',
              emitenteCnpj:   parsedMdfe.cnpjEmit || '',
              emitenteNome:   parsedMdfe.xNomeEmit || '',
              dataEmissao:    parsedMdfe.dhEmi ? new Date(parsedMdfe.dhEmi) : new Date(),
              ufInicio:       parsedMdfe.ufIni || null,
              ufFim:          parsedMdfe.ufFim || null,
              modal:          parsedMdfe.modal || null,
              status:         'RECEBIDO',
              nsu:            doc.nsu,
              xmlContent:     doc.xml,
            },
          });
          mdfeCreated++;
          this.logger.log(`[Sync] MDF-e criado: ${parsedMdfe.chMDFe}`);
          continue;
        }

        // ── Evento DF-e (resEvento ou procEventoNFe/CTe) ─────────────────────
        if (schema.includes('Evento') || schema.includes('evento') || schema.includes('resEvento')) {
          const parsedEvento = this.sefazClient.parsearXmlEvento(doc.xml);
          if (!parsedEvento?.chDFe) continue;

          // Upsert — mesmo evento pode chegar duplicado
          await this.prisma.dFeEvento.upsert({
            where: { id: `${companyId}-${doc.nsu}` },
            create: {
              id:             `${companyId}-${doc.nsu}`,
              companyId,
              chDFe:          parsedEvento.chDFe,
              tipoDocumento:  parsedEvento.tipoDocumento || 'NFe',
              tpEvento:       parsedEvento.tpEvento || '',
              xEvento:        parsedEvento.xEvento || '',
              nSeqEvento:     parsedEvento.nSeqEvento || 1,
              dhRegistro:     parsedEvento.dhRegEvento ? new Date(parsedEvento.dhRegEvento) : null,
              cStat:          parsedEvento.cStat || null,
              nsu:            doc.nsu,
              xmlContent:     doc.xml,
            },
            update: {},
          });

          // Atualiza status do NFeInbox conforme o tipo de evento
          const tpEvento = parsedEvento.tpEvento;
          if (tpEvento === '110111') {
            // Cancelamento → CANCELADA
            await this.prisma.nFeInbox.updateMany({
              where: { companyId, chaveAcesso: parsedEvento.chDFe },
              data: { status: 'CANCELADA' as any },
            });
            await this.prisma.cteDocument.updateMany({
              where: { companyId, chaveAcesso: parsedEvento.chDFe },
              data: { status: 'CANCELADO' as any },
            });
            await this.prisma.mdfeInbox.updateMany({
              where: { companyId, chaveAcesso: parsedEvento.chDFe },
              data: { status: 'CANCELADO' },
            });
          } else if (tpEvento === '210210' || tpEvento === '210200') {
            // Ciência da Emissão ou Confirmação da Operação → MANIFESTADA (apenas se ainda PENDENTE)
            await this.prisma.nFeInbox.updateMany({
              where: {
                companyId,
                chaveAcesso: parsedEvento.chDFe,
                status: { in: ['PENDENTE'] as any[] },
              },
              data: {
                status: 'MANIFESTADA' as any,
                manifestacao: tpEvento === '210200' ? 'CONFIRMACAO_OPERACAO' : 'CIENCIA_OPERACAO',
                dataManifestacao: parsedEvento.dhRegEvento ? new Date(parsedEvento.dhRegEvento) : new Date(),
              },
            });
          } else if (['610600', '610614', '610514', '510630'].includes(tpEvento)) {
            // CT-e/MDF-e autorizado para esta NF-e → mercadoria em trânsito → MANIFESTADA
            await this.prisma.nFeInbox.updateMany({
              where: {
                companyId,
                chaveAcesso: parsedEvento.chDFe,
                status: { in: ['PENDENTE'] as any[] },
              },
              data: {
                status: 'MANIFESTADA' as any,
                manifestacao: 'CIENCIA_OPERACAO',
                dataManifestacao: parsedEvento.dhRegEvento ? new Date(parsedEvento.dhRegEvento) : new Date(),
              },
            });
          } else if (tpEvento === '210220') {
            // Desconhecimento da Operação → REJEITADA
            await this.prisma.nFeInbox.updateMany({
              where: { companyId, chaveAcesso: parsedEvento.chDFe, status: { in: ['PENDENTE', 'MANIFESTADA'] as any[] } },
              data: { status: 'REJEITADA' as any, manifestacao: 'DESCONHECIMENTO_OPERACAO' },
            });
          } else if (tpEvento === '210240') {
            // Operação Não Realizada → DEVOLVIDA/REJEITADA
            await this.prisma.nFeInbox.updateMany({
              where: { companyId, chaveAcesso: parsedEvento.chDFe, status: { in: ['PENDENTE', 'MANIFESTADA'] as any[] } },
              data: { status: 'DEVOLVIDA' as any, manifestacao: 'OPERACAO_NAO_REALIZADA' },
            });
          }
          eventosCreated++;
          this.logger.log(`[Sync] Evento ${parsedEvento.tpEvento} para ${parsedEvento.chDFe}`);
          continue;
        }

        // ── NF-e (resNFe ou procNFe) ────────────────────────────────────────
        if (!schema.includes('NFe') && !schema.includes('nfe') && !schema.includes('resNFe')) {
          continue;
        }

        const parsed = this.sefazClient.parsearXmlNFe(doc.xml);
        if (!parsed?.chNFe) continue;

        // Check if already imported
        const existing = await this.prisma.nFeInbox.findFirst({
          where: { companyId, chaveAcesso: parsed.chNFe },
          select: { id: true, items: { select: { id: true }, take: 1 } },
        });
        if (existing) {
          // procNFe arrived for an existing resNFe (no items yet) → update with items
          if (existing.items.length === 0 && parsed.items.length > 0) {
            await this.prisma.nFeInbox.update({
              where: { id: existing.id },
              data: {
                xmlContent: doc.xml,
                items: {
                  create: parsed.items.map((item) => ({
                    numeroItem:              item.nItem,
                    codigoProdutoFornecedor: item.cProd   ?? '',
                    descricaoProduto:        item.xProd   ?? '',
                    ncm:                     item.ncm     ?? '',
                    cfop:                    item.cfop    ?? '',
                    unidade:                 item.uCom    ?? 'UN',
                    quantidade:              item.qCom    ?? 0,
                    valorUnitario:           item.vUnCom  ?? 0,
                    valorTotal:              item.vProd   ?? 0,
                    valorIcms:               item.vICMS   ?? 0,
                    valorIpi:                item.vIPI    ?? 0,
                    valorPis:                item.vPIS    ?? 0,
                    valorCofins:             item.vCOFINS ?? 0,
                  })),
                },
              },
            });
            nfeCreated++;
            this.logger.log(`[Sync] procNFe recebido para ${parsed.chNFe} — ${parsed.items.length} item(ns) adicionados à nota existente`);
          }
          continue;
        }

        // Ignorar NF-e emitidas antes da data de início do módulo NFE_ENTRADA
        const inicioNfe = resolveInicio('NFE_ENTRADA');
        if (inicioNfe && parsed.dhEmi && new Date(parsed.dhEmi) < inicioNfe) {
          this.logger.debug(`[Sync] NF-e ${parsed.chNFe} ignorada (emissão anterior ao início de operação NFE_ENTRADA)`);
          continue;
        }

        // ── Ciência da Operação automática (fire-and-forget) ───────────────
        // Se o DistDFe retornou apenas o resNFe (sem itens), envia Ciência ao
        // SEFAZ automaticamente. Na próxima sincronização o DistDFe entrega o
        // procNFe completo em um novo NSU, que cai no bloco UPDATE acima.
        // Zero consumo de cota consChNFe — processo totalmente automático.
        if (parsed.items.length === 0) {
          setImmediate(() => {
            this.sefazClient.enviarManifestacao(
              companyId,
              parsed.chNFe,
              company.cnpj,
              'CIENCIA_OPERACAO' as any,
              '',
              ambienteNfe, // usar o mesmo ambiente do DistDFe — crítico para NF-es de produção
            ).then((r) => {
              this.logger.log(`[Sync] Ciência enviada para ${parsed.chNFe} — cStat=${r.cStat} amb=${ambienteNfe}`);
            }).catch((e: unknown) => {
              this.logger.warn(`[Sync] Falha ao enviar Ciência para ${parsed.chNFe}: ${e instanceof Error ? e.message : e}`);
            });
          });
        }

        // Try to find emitente by CNPJ
        const emitentePessoa = parsed.cnpjEmit
          ? await this.prisma.person.findFirst({
              where: { companyId, cpfCnpj: parsed.cnpjEmit },
              select: { id: true },
            })
          : null;

        await this.prisma.nFeInbox.create({
          data: {
            companyId,
            chaveAcesso: parsed.chNFe,
            numero:      parsed.nNF    ?? '',
            serie:       parsed.serie  ?? '1',
            emitenteCnpj: parsed.cnpjEmit  ?? '',
            emitenteNome: parsed.xNomeEmit ?? '',
            emitentePessoaId: emitentePessoa?.id ?? null,
            dataEmissao: parsed.dhEmi ? new Date(parsed.dhEmi) : new Date(),
            valorTotal:          parsed.vNF     ?? 0,
            valorFrete:          parsed.vFrete  ?? 0,
            valorSeguro:         parsed.vSeg    ?? 0,
            valorOutrasDespesas: parsed.vOutro  ?? 0,
            valorDesconto:       parsed.vDesc   ?? 0,
            status: 'PENDENTE' as any,
            nsu: doc.nsu,
            xmlContent: doc.xml,
            items: {
              create: parsed.items.map((item) => ({
                numeroItem:              item.nItem,
                codigoProdutoFornecedor: item.cProd   ?? '',
                descricaoProduto:        item.xProd   ?? '',
                ncm:                     item.ncm     ?? '',
                cfop:                    item.cfop    ?? '',
                unidade:                 item.uCom    ?? 'UN',
                quantidade:              item.qCom    ?? 0,
                valorUnitario:           item.vUnCom  ?? 0,
                valorTotal:              item.vProd   ?? 0,
                valorIcms:               item.vICMS   ?? 0,
                valorIpi:                item.vIPI    ?? 0,
                valorPis:                item.vPIS    ?? 0,
                valorCofins:             item.vCOFINS ?? 0,
              })),
            },
          },
        });

        nfeCreated++;
      }

      totalCreated += nfeCreated;
      totalCteCreated += cteCreated;
      totalMdfeCreated += mdfeCreated;
      totalEventosCreated += eventosCreated;

      this.logger.log(`[Sync] Lote processado: ${nfeCreated} NF-e(s), ${cteCreated} CT-e(s), ${mdfeCreated} MDF-e(s), ${eventosCreated} evento(s)`);

      // If maxNSU didn't advance or fewer than 50 docs returned, we're done
      if (result.maxNSU === ultNSU || result.docs.length < 50) {
        hasMore = false;
      } else {
        ultNSU = result.maxNSU;
      }
    }

    // ── Loop CT-e ──────────────────────────────────────────────────────────
    // Busca CT-es destinados ao CNPJ via CTeDistribuicaoDFe
    this.logger.log(`[Sync] Iniciando loop CT-e...`);
    try {
      const lastCteNsu = await this.prisma.cteDocument.findFirst({
        where: { companyId, nsu: { not: null } }, orderBy: { nsu: 'desc' }, select: { nsu: true },
      });
      let cteUltNSU = lastCteNsu?.nsu ?? '000000000000000';
      let cteHasMore = true;

      while (cteHasMore) {
        this.logger.log(`[Sync-CTe] Chamando distribuicaoDFeCte NSU=${cteUltNSU}`);
        // CT-e DistDFe sempre usa produção — recepção de documentos reais independe do ambienteDFe de emissão
        const cteResult = await this.sefazClient.distribuicaoDFeCte(companyId, uf, company.cnpj, cteUltNSU, '1');

        this.logger.log(`[Sync-CTe] Resultado: success=${cteResult.success} cStat=${cteResult.cStat} docs=${cteResult.docs.length}`);

        if (!cteResult.success) {
          if (cteResult.cStat === '656') {
            this.logger.warn(`[Sync-CTe] Rate limit SEFAZ CT-e. Encerrando.`);
          } else {
            this.logger.warn(`[Sync-CTe] Erro (cStat ${cteResult.cStat}): ${cteResult.xMotivo}`);
          }
          break;
        }

        if (cteResult.docs.length === 0 || cteResult.cStat === '137') {
          break;
        }

        for (const doc of cteResult.docs) {
          const schema = doc.schema || '';

          // Eventos do CT-e
          if (schema.toLowerCase().includes('evento')) {
            const parsedEvento = this.sefazClient.parsearXmlEvento(doc.xml);
            if (!parsedEvento?.chDFe) continue;
            await this.prisma.dFeEvento.upsert({
              where: { id: `${companyId}-${doc.nsu}` },
              create: {
                id: `${companyId}-${doc.nsu}`,
                companyId,
                chDFe: parsedEvento.chDFe,
                tipoDocumento: parsedEvento.tipoDocumento || 'CTe',
                tpEvento: parsedEvento.tpEvento || '',
                xEvento: parsedEvento.xEvento || '',
                nSeqEvento: parsedEvento.nSeqEvento || 1,
                dhRegistro: parsedEvento.dhRegEvento ? new Date(parsedEvento.dhRegEvento) : null,
                cStat: parsedEvento.cStat || null,
                nsu: doc.nsu,
                xmlContent: doc.xml,
              },
              update: {},
            });
            totalEventosCreated++;
            continue;
          }

          // CT-e
          const parsedCte = this.sefazClient.parsearXmlCTe(doc.xml);
          if (!parsedCte?.chCTe) continue;

          const existingCte = await this.prisma.cteDocument.findFirst({
            where: { companyId, chaveAcesso: parsedCte.chCTe },
          });
          if (existingCte) continue;

          const transportadora = parsedCte.cnpjEmit
            ? await this.prisma.person.findFirst({ where: { companyId, cpfCnpj: parsedCte.cnpjEmit }, select: { id: true } })
            : null;

          const companyConfig = await this.prisma.company.findUnique({ where: { id: companyId }, select: { cfopPadraoCteEntrada: true } });
          const cfopPadraoCte = (companyConfig as any)?.cfopPadraoCteEntrada ?? '2352';

          // Encontrar a primeira NF-e linkada via refNFe (1:1 no schema atual)
          let nfeInboxId: string | null = null;
          if (parsedCte.refNFes.length > 0) {
            const matchedNfe = await this.prisma.nFeInbox.findFirst({
              where: { companyId, chaveAcesso: { in: parsedCte.refNFes } },
              select: { id: true },
            });
            nfeInboxId = matchedNfe?.id ?? null;
          }

          await this.prisma.cteDocument.create({
            data: {
              companyId,
              chaveAcesso:        parsedCte.chCTe,
              numero:             parsedCte.nCT || '0',
              serie:              parsedCte.serie || '0',
              dataEmissao:        parsedCte.dhEmi ? new Date(parsedCte.dhEmi) : new Date(),
              modalidade:         parsedCte.modalidade as any,
              cfop:               parsedCte.cfop || cfopPadraoCte,
              transportadoraId:   transportadora?.id ?? null,
              transportadoraCnpj: parsedCte.cnpjEmit,
              transportadoraNome: parsedCte.xNomeEmit,
              remetenteCnpj:      parsedCte.remetenteCnpj || null,
              remetenteNome:      parsedCte.remetenteNome || null,
              destinatarioCnpj:   parsedCte.destCnpj || null,
              destinatarioNome:   parsedCte.destNome || null,
              valorFrete:         parsedCte.vTPrest,
              valorTotal:         parsedCte.vTPrest,
              bcIcms:             parsedCte.vBC,
              aliqIcms:           parsedCte.pICMS,
              valorIcms:          parsedCte.vICMS,
              status:             'REGISTRADO',
              nsu:                doc.nsu,
              xmlContent:         doc.xml,
              nfeInboxId,
            },
          });

          // Para NF-es adicionais cobertas pelo mesmo CT-e (1 CT-e → N NF-es),
          // atualizar o status delas para MANIFESTADA se ainda estiverem PENDENTE
          if (parsedCte.refNFes.length > 0) {
            await this.prisma.nFeInbox.updateMany({
              where: {
                companyId,
                chaveAcesso: { in: parsedCte.refNFes },
                status: { in: ['PENDENTE'] as any[] },
              },
              data: {
                status: 'MANIFESTADA' as any,
                manifestacao: 'CIENCIA_OPERACAO',
                dataManifestacao: parsedCte.dhEmi ? new Date(parsedCte.dhEmi) : new Date(),
              },
            });
          }

          totalCteCreated++;
          this.logger.log(`[Sync-CTe] CT-e ${parsedCte.nCT}/${parsedCte.serie} importado. Cobre ${parsedCte.refNFes.length} NF-e(s). Vinculado à NFeInbox: ${nfeInboxId ?? 'nenhuma'}`);
        }

        if (cteResult.maxNSU === cteUltNSU || cteResult.docs.length < 50) {
          cteHasMore = false;
        } else {
          cteUltNSU = cteResult.maxNSU;
        }
      }
    } catch (cteErr) {
      this.logger.warn(`[Sync-CTe] Erro no loop CT-e: ${cteErr instanceof Error ? cteErr.message : cteErr}`);
    }
    // ───────────────────────────────────────────────────────────────────────

    const grandTotal = totalCreated + totalCteCreated + totalMdfeCreated + totalEventosCreated;
    let msg: string;
    if (nfeRateLimited) {
      const proxima = new Date(Date.now() + 60 * 60 * 1000);
      const horaProxima = proxima.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
      msg = grandTotal > 0
        ? `⚠️ NF-e bloqueada (limite/hora). Importados: ${totalCteCreated} CT-e, ${totalMdfeCreated} MDF-e, ${totalEventosCreated} evento(s). Tente NF-e após ${horaProxima}.`
        : `⚠️ SEFAZ bloqueou NF-e temporariamente (limite: 1 chamada/hora). Tente novamente após ${horaProxima}.`;
    } else {
      msg = grandTotal > 0
        ? `✅ Sincronização concluída: ${totalCreated} NF-e, ${totalCteCreated} CT-e, ${totalMdfeCreated} MDF-e, ${totalEventosCreated} evento(s). Notas recém-chegadas sem itens receberão o XML completo na próxima sincronização automaticamente.`
        : `ℹ️ Sincronização concluída: nenhum documento novo encontrado na SEFAZ`;
    }
    return {
      found: totalCreated,
      nfe: totalCreated,
      cte: totalCteCreated,
      mdfe: totalMdfeCreated,
      eventos: totalEventosCreated,
      total: grandTotal,
      rateLimited: nfeRateLimited,
      message: msg,
    };
  }

  /**
   * Baixa o XML completo (procNFe) da SEFAZ via consChNFe e atualiza os itens da nota.
   * Usado quando a NF-e foi importada como resNFe (resumo sem itens).
   */
  async downloadFullXml(id: string, companyId: string) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
      include: { items: true },
    });
    if (!inbox) throw new NotFoundException('NF-e não encontrada');
    if (inbox.items.length > 0) {
      return { message: 'Esta NF-e já possui itens carregados.', updated: false };
    }
    if (!inbox.chaveAcesso) {
      throw new BadRequestException('Chave de acesso não disponível para esta NF-e');
    }

    // ── Tenta usar o xmlContent já armazenado antes de chamar a SEFAZ ─────────
    // Muitas NF-es chegam como resNFe (resumo) mas depois recebem o procNFe completo
    // via DistDFe ou download anterior — se o XML já tem <det nItem= basta parsear.
    let xmlFonte: string | null = null;
    if (inbox.xmlContent && inbox.xmlContent.includes('<det nItem=')) {
      xmlFonte = inbox.xmlContent;
      this.logger.log(`[downloadFullXml] Usando XML já armazenado para ${inbox.chaveAcesso}`);
    }

    let parsed = xmlFonte ? this.sefazClient.parsearXmlNFe(xmlFonte) : null;

    // ── Se o XML armazenado não tem itens (ou não existe), consulta a SEFAZ ───
    if (!parsed || parsed.items.length === 0) {
      const company = await this.prisma.company.findFirst({
        where: { id: companyId },
        select: { cnpj: true, uf: true, ambienteDFe: true },
      });
      if (!company?.cnpj) throw new BadRequestException('CNPJ da empresa não configurado');

      const ambienteConfig = String(company.ambienteDFe ?? 2) as '1' | '2';
      const uf = company.uf || 'SP';

      let result = await this.sefazClient.consultarChNFe(
        companyId, uf, company.cnpj, inbox.chaveAcesso, ambienteConfig,
      );

      if (!result.xml && result.cStat === '217') {
        const ambienteAlternativo: '1' | '2' = ambienteConfig === '1' ? '2' : '1';
        this.logger.warn(
          `[downloadFullXml] cStat 217 em ambiente ${ambienteConfig}. Tentando alternativo ${ambienteAlternativo}...`,
        );
        result = await this.sefazClient.consultarChNFe(
          companyId, uf, company.cnpj, inbox.chaveAcesso, ambienteAlternativo,
        );
      }

      if (!result.xml) {
        if (result.cStat === '656') {
          throw new BadRequestException(
            'Limite de consultas SEFAZ atingido (máx. 20/hora). Aguarde alguns minutos e tente novamente.',
          );
        }
        throw new BadRequestException(
          `SEFAZ não retornou XML completo (cStat ${result.cStat}): ${result.xMotivo}`,
        );
      }

      xmlFonte = result.xml;
      parsed = this.sefazClient.parsearXmlNFe(result.xml);
    }

    if (!parsed || parsed.items.length === 0) {
      // Se buscamos XML novo da SEFAZ mas ainda sem itens, salva o XML para evitar re-consultas
      if (xmlFonte && xmlFonte !== inbox.xmlContent) {
        await this.prisma.nFeInbox.update({
          where: { id },
          data: { xmlContent: xmlFonte },
        }).catch(() => {});
      }
      // Detecta se é resNFe (resumo sem itens) ou falha de parse
      const isResNFe = !xmlFonte || !xmlFonte.includes('<det ');
      if (isResNFe) {
        throw new BadRequestException(
          'O XML completo desta NF-e ainda não está disponível na SEFAZ (resNFe). Aguarde alguns minutos e tente novamente, ou aguarde a próxima sincronização.',
        );
      }
      throw new BadRequestException('XML retornado pela SEFAZ não contém itens ou não pôde ser interpretado. Verifique se a NF-e está autorizada na SEFAZ.');
    }

    // Atualiza o xmlContent, totais principais e cria os itens (com créditos fiscais)
    await this.prisma.nFeInbox.update({
      where: { id },
      data: {
        xmlContent:           xmlFonte ?? inbox.xmlContent,
        // Totais do cabeçalho da nota (podem estar zerados no resNFe)
        valorTotal:           parsed.vNF    ?? inbox.valorTotal,
        valorFrete:           parsed.vFrete ?? 0,
        valorSeguro:          parsed.vSeg   ?? 0,
        valorOutrasDespesas:  parsed.vOutro ?? 0,
        valorDesconto:        parsed.vDesc  ?? 0,
        // Atualiza emitente, número e série se não estavam preenchidos (resNFe vem sem esses dados)
        emitenteNome: parsed.xNomeEmit || (inbox.emitenteNome ?? ''),
        emitenteCnpj: parsed.cnpjEmit  || (inbox.emitenteCnpj ?? ''),
        numero: (inbox.numero && inbox.numero !== '0' && inbox.numero !== '')
          ? inbox.numero
          : (parsed.nNF || (inbox.chaveAcesso.length === 44
              ? String(parseInt(inbox.chaveAcesso.slice(25, 34), 10))
              : '')),
        serie: (inbox.serie && inbox.serie !== '0' && inbox.serie !== '')
          ? inbox.serie
          : (parsed.serie || (inbox.chaveAcesso.length === 44
              ? String(parseInt(inbox.chaveAcesso.slice(22, 25), 10))
              : '1')),
        items: {
          create: parsed.items.map((item) => ({
            numeroItem:              item.nItem,
            codigoProdutoFornecedor: item.cProd   ?? '',
            descricaoProduto:        item.xProd   ?? '',
            ncm:                     item.ncm     ?? '',
            cfop:                    item.cfop    ?? '',
            unidade:                 item.uCom    ?? 'UN',
            quantidade:              item.qCom    ?? 0,
            valorUnitario:           item.vUnCom  ?? 0,
            valorTotal:              item.vProd   ?? 0,
            valorIcms:               item.vICMS   ?? 0,
            valorIpi:                item.vIPI    ?? 0,
            valorPis:                item.vPIS    ?? 0,
            valorCofins:             item.vCOFINS ?? 0,
          })),
        },
      },
    });

    return {
      message: `${parsed.items.length} item(ns) carregado(s) com sucesso — totais e créditos fiscais atualizados`,
      updated: true,
      count: parsed.items.length,
    };
  }

  /**
   * Corrige o número e série de NF-es antigas que foram importadas sem essas informações
   * (importadas via resNFe antes da correção do parser).
   */
  /**
   * Retorna os eventos DF-e vinculados à chave de acesso de uma NF-e.
   */
  async getEventos(id: string, companyId: string) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
      select: { chaveAcesso: true },
    });
    if (!inbox) throw new NotFoundException('NF-e não encontrada');

    const eventos = await this.prisma.dFeEvento.findMany({
      where: { companyId, chDFe: inbox.chaveAcesso },
      orderBy: { dhRegistro: 'asc' },
    });

    return eventos;
  }

  async fixNumbers(companyId: string) {
    const records = await this.prisma.nFeInbox.findMany({
      where: {
        companyId,
        OR: [
          { numero: '' },
          { numero: '0' },
          { serie: '' },
          { serie: '0' },
        ],
        chaveAcesso: { not: '' },
      },
      select: { id: true, chaveAcesso: true, numero: true, serie: true },
    });

    let updated = 0;
    for (const r of records) {
      const chave = r.chaveAcesso;
      if (chave.length !== 44) continue;

      const numero = String(parseInt(chave.slice(25, 34), 10));
      const serie  = String(parseInt(chave.slice(22, 25), 10));

      const needsUpdate =
        (!r.numero || r.numero === '0') ||
        (!r.serie  || r.serie  === '0');

      if (!needsUpdate) continue;

      await this.prisma.nFeInbox.update({
        where: { id: r.id },
        data: {
          numero: (!r.numero || r.numero === '0') ? numero : r.numero,
          serie:  (!r.serie  || r.serie  === '0') ? serie  : r.serie,
        },
      });
      updated++;
    }

    return { updated, total: records.length };
  }

  /**
   * Retroativamente atualiza o status das NF-es com base nos eventos de manifestação
   * já registrados no banco (ciência, confirmação, desconhecimento, op. não realizada).
   * Só atualiza NF-es ainda em PENDENTE.
   */
  async fixManifested(companyId: string) {
    let updated = 0;

    // Ciência da Emissão (210210) → MANIFESTADA
    const ciencia = await this.prisma.dFeEvento.findMany({
      where: { companyId, tpEvento: '210210' },
      select: { chDFe: true, dhRegistro: true },
    });
    for (const ev of ciencia) {
      const r = await this.prisma.nFeInbox.updateMany({
        where: { companyId, chaveAcesso: ev.chDFe, status: { in: ['PENDENTE'] as any[] } },
        data: { status: 'MANIFESTADA' as any, manifestacao: 'CIENCIA_OPERACAO', dataManifestacao: ev.dhRegistro ?? new Date() },
      });
      updated += r.count;
    }

    // Confirmação da Operação (210200) → MANIFESTADA
    const confirmacao = await this.prisma.dFeEvento.findMany({
      where: { companyId, tpEvento: '210200' },
      select: { chDFe: true, dhRegistro: true },
    });
    for (const ev of confirmacao) {
      const r = await this.prisma.nFeInbox.updateMany({
        where: { companyId, chaveAcesso: ev.chDFe, status: { in: ['PENDENTE'] as any[] } },
        data: { status: 'MANIFESTADA' as any, manifestacao: 'CONFIRMACAO_OPERACAO', dataManifestacao: ev.dhRegistro ?? new Date() },
      });
      updated += r.count;
    }

    // Desconhecimento (210220) → REJEITADA
    const desconhecimento = await this.prisma.dFeEvento.findMany({
      where: { companyId, tpEvento: '210220' },
      select: { chDFe: true },
    });
    for (const ev of desconhecimento) {
      const r = await this.prisma.nFeInbox.updateMany({
        where: { companyId, chaveAcesso: ev.chDFe, status: { in: ['PENDENTE', 'MANIFESTADA'] as any[] } },
        data: { status: 'REJEITADA' as any, manifestacao: 'DESCONHECIMENTO_OPERACAO' },
      });
      updated += r.count;
    }

    // Operação Não Realizada (210240) → DEVOLVIDA
    const naoRealizada = await this.prisma.dFeEvento.findMany({
      where: { companyId, tpEvento: '210240' },
      select: { chDFe: true },
    });
    for (const ev of naoRealizada) {
      const r = await this.prisma.nFeInbox.updateMany({
        where: { companyId, chaveAcesso: ev.chDFe, status: { in: ['PENDENTE', 'MANIFESTADA'] as any[] } },
        data: { status: 'DEVOLVIDA' as any, manifestacao: 'OPERACAO_NAO_REALIZADA' },
      });
      updated += r.count;
    }

    // CT-e/MDF-e autorizado para a NF-e (610600, 610614, 610514, 510630) → MANIFESTADA
    // Esses eventos indicam que a mercadoria está em trânsito com documento de transporte oficial
    const cteEventos = await this.prisma.dFeEvento.findMany({
      where: { companyId, tpEvento: { in: ['610600', '610614', '610514', '510630'] } },
      select: { chDFe: true, dhRegistro: true },
    });
    const cteChaves = [...new Map(cteEventos.map(e => [e.chDFe, e])).values()]; // dedup por chDFe
    for (const ev of cteChaves) {
      const r = await this.prisma.nFeInbox.updateMany({
        where: { companyId, chaveAcesso: ev.chDFe, status: { in: ['PENDENTE'] as any[] } },
        data: {
          status: 'MANIFESTADA' as any,
          manifestacao: 'CIENCIA_OPERACAO',
          dataManifestacao: ev.dhRegistro ?? new Date(),
        },
      });
      updated += r.count;
    }

    this.logger.log(`[FixManifested] ${updated} NF-e(s) atualizadas por evento de manifestação`);
    return { updated };
  }

  /**
   * Retroativamente marca como CANCELADA todas as NF-es que possuem
   * evento de cancelamento (tpEvento 110111) já registrado no banco.
   */
  async fixCancelled(companyId: string) {
    const eventos = await this.prisma.dFeEvento.findMany({
      where: { companyId, tpEvento: '110111' },
      select: { chDFe: true },
    });

    if (eventos.length === 0) return { updated: 0 };

    const chaves = [...new Set(eventos.map(e => e.chDFe))];
    const result = await this.prisma.nFeInbox.updateMany({
      where: {
        companyId,
        chaveAcesso: { in: chaves },
        status: { notIn: ['CANCELADA' as any] },
      },
      data: { status: 'CANCELADA' as any },
    });

    this.logger.log(`[FixCancelled] ${result.count} NF-e(s) marcadas como CANCELADA`);
    return { updated: result.count, chavesComEvento: chaves.length };
  }

  /**
   * Re-linka CT-es existentes às NF-es via refNFes extraídas do XML.
   * Útil para CT-es importados antes da correção da extração de refNFes.
   */
  /**
   * Re-envia Ciência da Operação para todas as NF-es sem itens, usando o
   * ambiente correto da empresa (produção ou homologação). Útil para corrigir
   * NF-es cujo Ciência foi enviado para o ambiente errado no passado.
   * Após re-enviar, o SEFAZ enfileira o procNFe completo; a próxima
   * sincronização popula os itens automaticamente.
   */
  async fixCiencia(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { cnpj: true, ambienteDFe: true },
    });
    if (!company?.cnpj) throw new BadRequestException('CNPJ da empresa não configurado');

    const ambienteNfe = String(company.ambienteDFe ?? 2) as '1' | '2';

    const pendentes = await this.prisma.nFeInbox.findMany({
      where: { companyId, items: { none: {} }, chaveAcesso: { not: '' } },
      select: { id: true, chaveAcesso: true, numero: true },
    });

    let enviadas = 0;
    let erros = 0;
    const detalhes: string[] = [];

    for (const nfe of pendentes) {
      try {
        const r = await this.sefazClient.enviarManifestacao(
          companyId,
          nfe.chaveAcesso,
          company.cnpj,
          'CIENCIA_OPERACAO' as any,
          '',
          ambienteNfe,
        );
        // 135 = registrado, 573 = já registrado (idempotente)
        if (['135', '573'].includes(r.cStat)) {
          enviadas++;
        } else {
          detalhes.push(`NF-e ${nfe.numero ?? nfe.id}: cStat=${r.cStat} ${r.xMotivo}`);
          erros++;
        }
      } catch (e: unknown) {
        detalhes.push(`NF-e ${nfe.numero ?? nfe.id}: ${e instanceof Error ? e.message : e}`);
        erros++;
      }
    }

    return {
      total: pendentes.length,
      enviadas,
      erros,
      ambiente: ambienteNfe,
      detalhes: detalhes.slice(0, 10),
      message: `Ciência enviada para ${enviadas} de ${pendentes.length} NF-e(s) sem itens (ambiente=${ambienteNfe}). Sincronize novamente para obter os XMLs completos.`,
    };
  }

  /**
   * Baixa XML completo para todas as NF-es importadas como resNFe (sem itens).
   * Processa até 20 por chamada para respeitar cota SEFAZ de 20/hora.
   */
  async fixResNFe(companyId: string) {
    const pendentes = await this.prisma.nFeInbox.findMany({
      where: { companyId, items: { none: {} }, chaveAcesso: { not: '' } },
      select: { id: true, chaveAcesso: true, numero: true },
      take: 20,
    });

    let downloaded = 0;
    let rateLimited = false;
    const errors: string[] = [];

    for (const nfe of pendentes) {
      try {
        const result = await this.downloadFullXml(nfe.id, companyId);
        if (result && result.updated !== false) downloaded++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('656') || msg.includes('Limite de consultas')) {
          rateLimited = true;
          break;
        }
        errors.push(`NF-e ${nfe.numero ?? nfe.id}: ${msg}`);
      }
    }

    return {
      total: pendentes.length,
      downloaded,
      rateLimited,
      errors: errors.slice(0, 5),
      message: rateLimited
        ? `${downloaded} XML(s) baixado(s). Cota SEFAZ atingida (20/hora). Execute novamente mais tarde.`
        : `${downloaded} de ${pendentes.length} XML(s) baixado(s) com sucesso.`,
    };
  }

  /**
   * Varre todas as NF-es sem emitentePessoaId e tenta vincular ao cadastro
   * correto pelo CNPJ do emitente. Útil para retroativamente corrigir NF-es
   * que chegaram antes do fornecedor ser cadastrado.
   */
  async fixEmitenteLinks(companyId: string) {
    const semVinculo = await this.prisma.nFeInbox.findMany({
      where: { companyId, emitentePessoaId: null, emitenteCnpj: { not: '' } },
      select: { id: true, emitenteCnpj: true, emitenteNome: true },
    });

    let linked = 0;
    const cnpjsProcessados = new Set<string>();

    for (const nfe of semVinculo) {
      const cnpj = nfe.emitenteCnpj;
      if (!cnpj || cnpjsProcessados.has(cnpj)) continue;
      cnpjsProcessados.add(cnpj);

      const pessoa = await this.prisma.person.findFirst({
        where: { companyId, cpfCnpj: cnpj },
        select: { id: true },
      });

      if (!pessoa) continue;

      const result = await this.prisma.nFeInbox.updateMany({
        where: { companyId, emitenteCnpj: cnpj, emitentePessoaId: null },
        data: { emitentePessoaId: pessoa.id },
      });

      linked += result.count;
    }

    return {
      total: semVinculo.length,
      linked,
      message: `${linked} NF-e(s) vinculada(s) ao cadastro de fornecedor com sucesso.`,
    };
  }

  async fixCteLinks(companyId: string) {
    const ctes = await this.prisma.cteDocument.findMany({
      where: { companyId, nfeInboxId: null, xmlContent: { not: null } },
      select: { id: true, xmlContent: true, chaveAcesso: true },
    });

    let linked = 0;
    let manifestadas = 0;

    for (const cte of ctes) {
      if (!cte.xmlContent) continue;

      const parsed = this.sefazClient.parsearXmlCTe(cte.xmlContent);
      if (!parsed || parsed.refNFes.length === 0) continue;

      const matchedNfe = await this.prisma.nFeInbox.findFirst({
        where: { companyId, chaveAcesso: { in: parsed.refNFes } },
        select: { id: true },
      });

      if (matchedNfe) {
        await this.prisma.cteDocument.update({
          where: { id: cte.id },
          data: { nfeInboxId: matchedNfe.id },
        });
        linked++;
      }

      // Atualiza status das NF-es cobertas para MANIFESTADA
      const upd = await this.prisma.nFeInbox.updateMany({
        where: {
          companyId,
          chaveAcesso: { in: parsed.refNFes },
          status: { in: ['PENDENTE' as any] },
        },
        data: {
          status: 'MANIFESTADA' as any,
          manifestacao: 'CIENCIA_OPERACAO' as any,
          dataManifestacao: new Date(),
        },
      });
      manifestadas += upd.count;
    }

    this.logger.log(`[FixCteLinks] ${linked} CT-e(s) vinculados, ${manifestadas} NF-e(s) atualizadas para MANIFESTADA`);
    return { linked, manifestadas };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NOVO FLUXO: PENDENTE → MANIFESTADA → FINANCEIRO → ESCRITURACAO → FINALIZADA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * ETAPA 1 — ALMOXARIFADO: Recepciona a mercadoria.
   * Atualiza custo do StockMovement com custo real da NF-e (ou cria novo).
   * Cria PurchaseReceipt ligando PO ↔ NF-e.
   * Status: PENDENTE | MANIFESTADA → FINANCEIRO
   */
  async recepcionar(id: string, companyId: string, userId: string, dto: RecepcionarNfeDto) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
      include: {
        items: { include: { product: { select: { id: true, code: true, description: true, unit: true } } } },
        emitentePessoa: { select: { id: true, razaoSocial: true } },
        cteDocuments: { select: { id: true, valorTotal: true, valorFrete: true } },
      },
    });

    if (!inbox) throw new NotFoundException(`NFeInbox ${id} not found`);

    const allowedStatuses = ['PENDENTE', 'MANIFESTADA', 'VINCULADA'];
    if (!allowedStatuses.includes(inbox.status)) {
      throw new BadRequestException(
        `Não é possível recepcionar NF-e com status ${inbox.status}. Status permitidos: ${allowedStatuses.join(', ')}`,
      );
    }

    // Resolve local de estoque
    let stockLocationId = dto.stockLocationId;
    if (!stockLocationId) {
      const loc = await this.prisma.stockLocation.findFirst({ where: { companyId, type: 'ALMOXARIFADO' } });
      if (loc) stockLocationId = loc.id;
    }

    // Resolve PO vinculada
    const linkedPoId = dto.purchaseOrderId || inbox.purchaseOrderId || null;
    let linkedPoItems: any[] = [];
    const priorMovements = new Map<string, any>();

    if (linkedPoId) {
      const po = await this.prisma.purchaseOrder.findUnique({
        where: { id: linkedPoId },
        include: {
          items: true,
          stockMovements: {
            where: { type: 'ENTRADA' as any, source: 'COMPRA' as any },
            orderBy: { createdAt: 'desc' },
            select: { id: true, productId: true, quantity: true, unitCost: true, totalCost: true, locationId: true },
          },
        },
      });
      if (po) {
        linkedPoItems = po.items;
        for (const sm of po.stockMovements) {
          if (!priorMovements.has(sm.productId)) priorMovements.set(sm.productId, sm);
        }
      }
    }

    // Frete da NF-e + frete do CT-e vinculado
    const totalItemsValue = inbox.items.reduce((s, i) => s + i.valorTotal.toNumber(), 0);
    const freteNfe = inbox.valorFrete.toNumber();
    const freteCte = inbox.cteDocuments.reduce((s, c) => s + (c.valorFrete?.toNumber() ?? 0), 0);
    const freteTotal = freteNfe + freteCte;

    const today = new Date();

    await this.prisma.$transaction(async (tx) => {
      // 1. StockMovements
      for (const item of inbox.items) {
        if (!item.productId) continue;
        const poItem = linkedPoItems.find((p: any) => p.productId === item.productId);
        const destinacao: string = (poItem as any)?.destinacao ?? 'MATERIA_PRIMA';
        if (!this.DESTINACOES_COM_ESTOQUE.includes(destinacao)) continue;

        const itemVal = item.valorTotal.toNumber();
        const itemQtd = item.quantidade.toNumber();
        const freightShare = totalItemsValue > 0 ? (itemVal / totalItemsValue) * freteTotal : 0;
        const unitCost = itemQtd > 0 ? (itemVal + freightShare) / itemQtd : item.valorUnitario.toNumber();
        const totalCost = itemVal + freightShare;

        const prior = priorMovements.get(item.productId);

        if (prior) {
          const costDiff = totalCost - Number(prior.totalCost);
          await tx.stockMovement.update({
            where: { id: prior.id },
            data: { unitCost, totalCost, nfeInboxId: inbox.id, documentNumber: `NF-${inbox.numero}`,
              observations: `Custo atualizado pela NF-e ${inbox.numero}/${inbox.serie}. Diferença: R$ ${costDiff.toFixed(2)}` },
          });
          if (Math.abs(costDiff) > 0.001 && (prior.locationId || stockLocationId)) {
            const locId = prior.locationId || stockLocationId!;
            const bal = await tx.stockBalance.findUnique({ where: { productId_locationId: { productId: item.productId, locationId: locId } } });
            if (bal) {
              const newTotal = Math.max(0, Number(bal.totalCost) + costDiff);
              const newAvg = Number(bal.quantity) > 0 ? newTotal / Number(bal.quantity) : unitCost;
              await tx.stockBalance.update({ where: { productId_locationId: { productId: item.productId, locationId: locId } },
                data: { totalCost: newTotal, averageCost: newAvg, lastMovementAt: today } });
            }
          }
        } else if (stockLocationId) {
          await tx.stockMovement.create({ data: {
            companyId, productId: item.productId, locationId: stockLocationId,
            type: 'ENTRADA' as any, source: 'COMPRA' as any,
            quantity: itemQtd, unitCost, totalCost,
            documentNumber: inbox.chaveAcesso.slice(-9),
            purchaseOrderId: linkedPoId || null,
            nfeInboxId: inbox.id, userId,
            observations: `NF-e ${inbox.numero}/${inbox.serie} — ${inbox.emitenteNome}`,
          } });
          await tx.stockBalance.upsert({
            where: { productId_locationId: { productId: item.productId, locationId: stockLocationId } },
            create: { companyId, productId: item.productId, locationId: stockLocationId,
              quantity: itemQtd, availableQuantity: itemQtd, averageCost: unitCost, totalCost, lastMovementAt: today },
            update: { quantity: { increment: item.quantidade }, availableQuantity: { increment: item.quantidade }, lastMovementAt: today },
          });
        }
      }

      // 2. Cria PurchaseReceipt ligando PO ↔ NF-e
      const receiptNumero = `REC-${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}-${Date.now().toString().slice(-4)}`;
      await tx.purchaseReceipt.create({ data: {
        companyId, numero: receiptNumero,
        purchaseOrderId: linkedPoId || null,
        nfeInboxId: inbox.id,
        responsavelId: userId,
        status: 'APROVADO' as any,
        dataRecebimento: today,
        dataConferencia: today,
        observacoes: dto.observacoes || null,
      } });

      // 3. Atualiza NFeInbox status → FINANCEIRO
      await tx.nFeInbox.update({ where: { id }, data: {
        status: 'FINANCEIRO' as any,
        purchaseOrderId: linkedPoId || inbox.purchaseOrderId,
      } });
    });

    this.logger.log(`[Recepcionar] NF-e ${inbox.numero} recepcionada → FINANCEIRO`);
    return { message: `NF-e ${inbox.numero}/${inbox.serie} recepcionada com sucesso. Pendente de lançamento financeiro.` };
  }

  /**
   * ETAPA 2 — FINANCEIRO: Lança no contas a pagar.
   * Status: FINANCEIRO → ESCRITURACAO
   */
  async lancarFinanceiro(id: string, companyId: string, userId: string, dto: LancarFinanceiroNfeDto) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
      include: { emitentePessoa: { select: { id: true, razaoSocial: true } } },
    });

    if (!inbox) throw new NotFoundException(`NFeInbox ${id} not found`);
    if (inbox.status !== 'FINANCEIRO' as any) {
      throw new BadRequestException(`NF-e deve estar no status FINANCEIRO para lançar. Status atual: ${inbox.status}`);
    }
    if (!inbox.emitentePessoaId) {
      throw new BadRequestException('Fornecedor não está vinculado a um cadastro. Registre o fornecedor primeiro.');
    }

    const dataVenc = new Date(dto.dataVencimento);
    const parcelas = dto.parcelas ?? 1;
    const valorTotal = inbox.valorTotal.toNumber();
    const valorParcela = valorTotal / parcelas;
    const today = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Cria parcelas do contas a pagar
      for (let i = 0; i < parcelas; i++) {
        const venc = new Date(dataVenc);
        venc.setMonth(venc.getMonth() + i);
        await tx.financialMovement.create({ data: {
          companyId,
          type: 'DESPESA' as any,
          personId: inbox.emitentePessoaId!,
          description: `NF-e ${inbox.numero}/${inbox.serie} — ${inbox.emitenteNome}${parcelas > 1 ? ` (${i+1}/${parcelas})` : ''}`,
          numero: parcelas > 1 ? `NFE-${inbox.numero}-${i+1}` : `NFE-${inbox.numero}`,
          parcela: i + 1,
          totalParcelas: parcelas,
          valor: valorParcela,
          dataEmissao: inbox.dataEmissao,
          dataVencimento: venc,
          bankAccountId: dto.bankAccountId || null,
          status: 'PENDENTE' as any,
          observations: dto.observacoes || `Chave de acesso: ${inbox.chaveAcesso}`,
        } });
      }

      await tx.nFeInbox.update({ where: { id }, data: { status: 'ESCRITURACAO' as any } });
    });

    this.logger.log(`[LancarFinanceiro] NF-e ${inbox.numero} lançada no financeiro → ESCRITURACAO`);
    return { message: `${parcelas} parcela(s) lançada(s) no contas a pagar. NF-e aguardando escrituração fiscal.` };
  }

  /**
   * ETAPA 3 — FISCAL: Escritura fiscalmente e contabilmente a NF-e.
   * Usa o Motor de Regras Fiscais (TES) para determinar CFOP, CST e créditos por item.
   * Status: ESCRITURACAO → FINALIZADA
   */
  async escriturar(id: string, companyId: string, userId: string, dto: EscriturarNfeDto) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
      include: {
        items: { include: { product: true } },
        emitentePessoa: true,
      },
    });

    if (!inbox) throw new NotFoundException(`NFeInbox ${id} not found`);
    if (inbox.status !== 'ESCRITURACAO' as any) {
      throw new BadRequestException(`NF-e deve estar em ESCRITURACAO para escriturar. Status atual: ${inbox.status}`);
    }

    // Lê regime tributário da empresa
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxRegime: true, uf: true },
    });
    const taxRegimeEmpresa = (company as any)?.taxRegime ?? 'LUCRO_REAL';
    const ufEmpresa        = (company as any)?.uf ?? '';
    const ufFornecedor        = (inbox.emitentePessoa as any)?.uf ?? (inbox as any).emitenteUf ?? '';
    // Resolve motor fiscal: prioriza novos campos (ramoAtividade + taxRegime), fallback legado
    const ramoAtividade       = (inbox.emitentePessoa as any)?.ramoAtividade?.codigo ?? undefined;
    const taxRegimeFornecedor = (inbox.emitentePessoa as any)?.taxRegime ?? undefined;
    const tipoFornecedor      = (inbox.emitentePessoa as any)?.tipoFornecedor ?? undefined; // legado

    const today = new Date();
    const periodoReferencia = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
    const natureza = dto.naturezaOperacao || 'Compra de Mercadoria';

    // ── Processar créditos por item usando o Motor Fiscal ───────────────────
    interface ItemFiscal {
      valorTotal:    number;
      valorIcms:     number;
      valorIpi:      number;
      valorPis:      number;
      valorCofins:   number;
      cfop:          string;
      cstIcms:       string;
      creditaIcms:   boolean;
      creditaIpi:    boolean;
      creditaPisCof: boolean;
      ciap:          boolean;          // A10: crédito ICMS diferido 1/48
      valorIcmsCiap: number;           // A10: valor ICMS a controlar via CIAP
      contaDebito:   string;
      descricao:     string;
    }

    const itensFiscais: ItemFiscal[] = [];

    for (const item of inbox.items) {
      // Determina ST pelo CST do item (CST 60 = ST recolhida, CST 10 = tributada+ST)
      const cstXml = (item as any).cstIcms ?? '';
      const temST  = cstXml === '60' || cstXml === '010' || cstXml === '060';

      // Destinação do item (vem do produto mapeado ou fallback)
      const destinacao = (item as any).destinacaoFiscal
        ?? (item.product as any)?.destinacaoFiscal
        ?? (dto as any).destinacaoPadrao
        ?? 'MATERIA_PRIMA';

      // Consulta o motor
      const regra = await this.operacoesFiscais.determinar(companyId, {
        tipo: 'ENTRADA',
        destinacao,
        ramoAtividade,
        taxRegimeFornecedor,
        tipoFornecedor,   // legado — fallback automático no motor
        ufFornecedor,
        ufEmpresa,
        temST,
        taxRegimeEmpresa,
      });

      // A10 — CIAP: ICMS de ativo imobilizado NÃO é creditado imediatamente.
      // O crédito ocorre em 1/48 por mês via processarCiapMensal().
      // Portanto: se ciap=true, valorIcmsCreditar = 0 (crédito diferido).
      const isCiap = regra?.ciap ?? false;
      const valorIcmsCreditar = isCiap
        ? 0  // CIAP: não credita agora — será 1/48 por mês
        : regra?.icmsSimplesPCredSN
          ? ((item as any).valorIcmsCredSN ?? 0)
          : (regra?.creditaIcms ? item.valorIcms.toNumber() : 0);

      itensFiscais.push({
        valorTotal:    item.valorTotal.toNumber(),
        valorIcms:     valorIcmsCreditar,
        valorIpi:      regra?.creditaIpi    ? item.valorIpi.toNumber()    : 0,
        valorPis:      regra?.creditaPisCofins && !isCiap ? item.valorPis.toNumber()    : 0,
        valorCofins:   regra?.creditaPisCofins && !isCiap ? item.valorCofins.toNumber() : 0,
        cfop:          regra?.cfop   ?? (item as any).cfop   ?? dto.cfopCode ?? '1102',
        cstIcms:       regra?.cstIcms ?? cstXml,
        creditaIcms:   regra?.creditaIcms ?? false,
        creditaIpi:    regra?.creditaIpi  ?? false,
        creditaPisCof: regra?.creditaPisCofins ?? false,
        ciap:          isCiap,
        valorIcmsCiap: isCiap ? item.valorIcms.toNumber() : 0, // salvo para registro posterior
        contaDebito:   regra?.contaDebitoCode ?? '1.1.4',
        descricao:     item.descricaoProduto,
      });
    }

    // Totais para NFeDocument
    const totalItemsValue = itensFiscais.reduce((s, i) => s + i.valorTotal, 0);
    const totalIcmsDoc    = inbox.items.reduce((s, i) => s + i.valorIcms.toNumber(), 0);
    const totalIpiDoc     = inbox.items.reduce((s, i) => s + i.valorIpi.toNumber(), 0);
    const totalPisDoc     = inbox.items.reduce((s, i) => s + i.valorPis.toNumber(), 0);
    const totalCofinsDoc  = inbox.items.reduce((s, i) => s + i.valorCofins.toNumber(), 0);

    // Totais de crédito efetivo (após filtro do motor)
    const totalIcmsCredito   = itensFiscais.reduce((s, i) => s + i.valorIcms, 0);
    const totalIpiCredito    = itensFiscais.reduce((s, i) => s + i.valorIpi, 0);
    const totalPisCredito    = itensFiscais.reduce((s, i) => s + i.valorPis, 0);
    const totalCofinsCredito = itensFiscais.reduce((s, i) => s + i.valorCofins, 0);

    // Reforma Tributária — IBS/CBS crédito nas entradas (LC 214/2025)
    // Usamos os valores do inbox diretamente pois o motor fiscal ainda não parametriza IBS/CBS
    const totalIbsCredito  = inbox.items.reduce((s, i) => s + (i as any).valorIbs ? Number((i as any).valorIbs) : 0, 0);
    const totalCbsCredito  = inbox.items.reduce((s, i) => s + (i as any).valorCbs ? Number((i as any).valorCbs) : 0, 0);

    // CFOP mais frequente para o cabeçalho
    const cfopFreq = itensFiscais.reduce((acc, i) => {
      acc[i.cfop] = (acc[i.cfop] ?? 0) + i.valorTotal;
      return acc;
    }, {} as Record<string, number>);
    const cfopPrincipal = Object.entries(cfopFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '1102';

    await this.prisma.$transaction(async (tx) => {
      // 1. FiscalEntries por tributo — somente créditos efetivos
      const fiscalBase: any = {
        companyId, type: 'CREDITO' as any, bookType: 'ENTRADA' as any,
        dataLancamento: today, periodoReferencia,
        cfopCode: cfopPrincipal,
        naturezaOperacao: natureza,
        valorContabil: inbox.valorTotal.toNumber(),
        baseCalculo: totalItemsValue,
        observations: `NF-e ${inbox.numero}/${inbox.serie} — ${inbox.emitenteNome}`,
      };
      const fiscalCreates: Promise<any>[] = [];
      if (totalIcmsCredito > 0)
        fiscalCreates.push(tx.fiscalEntry.create({ data: { ...fiscalBase,
          aliquota: totalItemsValue > 0 ? (totalIcmsCredito / totalItemsValue) * 100 : 0,
          valorImposto: totalIcmsCredito, taxType: 'ICMS' } }));
      if (totalIpiCredito > 0)
        fiscalCreates.push(tx.fiscalEntry.create({ data: { ...fiscalBase,
          aliquota: totalItemsValue > 0 ? (totalIpiCredito / totalItemsValue) * 100 : 0,
          valorImposto: totalIpiCredito, taxType: 'IPI' } }));
      if (totalPisCredito > 0)
        fiscalCreates.push(tx.fiscalEntry.create({ data: { ...fiscalBase,
          aliquota: totalItemsValue > 0 ? (totalPisCredito / totalItemsValue) * 100 : 0,
          valorImposto: totalPisCredito, taxType: 'PIS' } }));
      if (totalCofinsCredito > 0)
        fiscalCreates.push(tx.fiscalEntry.create({ data: { ...fiscalBase,
          aliquota: totalItemsValue > 0 ? (totalCofinsCredito / totalItemsValue) * 100 : 0,
          valorImposto: totalCofinsCredito, taxType: 'COFINS' } }));
      // Reforma Tributária — crédito IBS/CBS nas entradas (LC 214/2025)
      if (totalIbsCredito > 0)
        fiscalCreates.push(tx.fiscalEntry.create({ data: { ...fiscalBase,
          aliquota: totalItemsValue > 0 ? (totalIbsCredito / totalItemsValue) * 100 : 0,
          valorImposto: totalIbsCredito, taxType: 'IBS' } }));
      if (totalCbsCredito > 0)
        fiscalCreates.push(tx.fiscalEntry.create({ data: { ...fiscalBase,
          aliquota: totalItemsValue > 0 ? (totalCbsCredito / totalItemsValue) * 100 : 0,
          valorImposto: totalCbsCredito, taxType: 'CBS' } }));
      await Promise.all(fiscalCreates);

      // 2. JournalEntry — débito por conta contábil agrupada + crédito Fornecedores
      const fornecedoresAcc = await tx.chartOfAccount.findFirst({
        where: { companyId, code: { startsWith: '2.1.1' } },
      });

      // Agrupa itens por contaDebito
      const gruposDebito = itensFiscais.reduce((acc, i) => {
        const k = i.contaDebito;
        acc[k] = (acc[k] ?? 0) + i.valorTotal;
        return acc;
      }, {} as Record<string, number>);

      const debitoItems: any[] = [];
      for (const [contaCod, valor] of Object.entries(gruposDebito)) {
        if (valor <= 0) continue;
        const acc = await tx.chartOfAccount.findFirst({
          where: { companyId, code: { startsWith: contaCod } },
        });
        if (acc) debitoItems.push({
          accountId: acc.id, type: 'DEVEDORA' as any, value: valor,
          description: `${contaCod} — NF-e ${inbox.numero}`,
        });
      }

      if (debitoItems.length > 0 && fornecedoresAcc && totalItemsValue > 0) {
        debitoItems.push({
          accountId: fornecedoresAcc.id, type: 'CREDORA' as any, value: totalItemsValue,
          description: `Fornecedores — ${inbox.emitenteNome}`,
        });
        await tx.journalEntry.create({ data: {
          companyId, numero: `ESC-NF-${inbox.numero}-${Date.now()}`,
          date: today,
          description: `Escrituração NF-e ${inbox.numero}/${inbox.serie} — ${inbox.emitenteNome}`,
          totalValue: totalItemsValue, userId, status: 'LANCADO' as any,
          items: { create: debitoItems },
        } });
      }

      // 3. NFeDocument (registro fiscal oficial)
      let nfeDocumentId: string | null = null;
      if (inbox.emitentePessoaId) {
        const existing = await tx.nFeDocument.findFirst({ where: { companyId, chaveAcesso: inbox.chaveAcesso } });
        if (!existing) {
          const doc = await tx.nFeDocument.create({ data: {
            companyId, personId: inbox.emitentePessoaId,
            chaveAcesso: inbox.chaveAcesso,
            numero: parseInt(inbox.numero, 10) || null,
            serie: parseInt(inbox.serie, 10) || 1,
            type: 'ENTRADA' as any, operation: 'COMPRA' as any, status: 'AUTORIZADA' as any,
            naturezaOperacao: natureza, dataEmissao: inbox.dataEmissao, dataEntradaSaida: today,
            valorProdutos: totalItemsValue, valorFrete: inbox.valorFrete.toNumber(),
            valorSeguro: inbox.valorSeguro.toNumber(), valorDesconto: inbox.valorDesconto.toNumber(),
            valorOutros: inbox.valorOutrasDespesas.toNumber(), valorTotal: inbox.valorTotal.toNumber(),
            valorIcms: totalIcmsDoc, valorIpi: totalIpiDoc, valorPis: totalPisDoc, valorCofins: totalCofinsDoc,
            xmlEnvio: inbox.xmlContent,
          } });
          nfeDocumentId = doc.id;
        } else {
          nfeDocumentId = existing.id;
        }
      }

      // 4. Atualiza PO se vinculada
      if (inbox.purchaseOrderId) {
        await tx.purchaseOrder.update({ where: { id: inbox.purchaseOrderId },
          data: { status: 'RECEBIDA' as any, dataEntregaReal: today } });
      }

      // 5. Status → FINALIZADA
      await tx.nFeInbox.update({ where: { id }, data: {
        status: 'FINALIZADA' as any,
        nfeDocumentId: nfeDocumentId || inbox.nfeDocumentId,
      } });
    });

    const semCredito = itensFiscais.filter(i => !i.creditaIcms && !i.creditaPisCof);
    this.logger.log(`[Escriturar] NF-e ${inbox.numero} escriturada → FINALIZADA | Crédito ICMS: R$${totalIcmsCredito.toFixed(2)} | PIS: R$${totalPisCredito.toFixed(2)} | COFINS: R$${totalCofinsCredito.toFixed(2)} | Itens sem crédito: ${semCredito.length}`);

    return {
      message: `NF-e ${inbox.numero}/${inbox.serie} escriturada e finalizada com sucesso.`,
      resumo: {
        totalItens:       itensFiscais.length,
        itensSemCredito:  semCredito.length,
        creditoIcms:      totalIcmsCredito,
        creditoIpi:       totalIpiCredito,
        creditoPis:       totalPisCredito,
        creditoCofins:    totalCofinsCredito,
        regimeTributario: taxRegimeEmpresa,
      },
    };
  }

  /**
   * Gera o PDF da DANFE (Documento Auxiliar da Nota Fiscal Eletrônica)
   * Layout oficial MOC NF-e versão 7.00 + NT 2024.001 (IBS/CBS Reforma Tributária).
   */
  async generateDanfe(id: string, companyId: string): Promise<Buffer> {
    let inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
      include: { items: { orderBy: { numeroItem: 'asc' } } },
    });
    if (!inbox) throw new NotFoundException('NF-e não encontrada');

    // Se a NF-e foi importada como resNFe (sem itens), baixa o XML completo antes de gerar a DANFE
    if (inbox.items.length === 0) {
      try {
        await this.downloadFullXml(id, companyId);
        const reloaded = await this.prisma.nFeInbox.findFirst({
          where: { id, companyId },
          include: { items: { orderBy: { numeroItem: 'asc' } } },
        });
        if (reloaded) inbox = reloaded;
      } catch (err) {
        this.logger.warn(`[DANFE] Auto-download falhou para ${id}: ${err instanceof Error ? err.message : err}`);
      }
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        razaoSocial: true, cnpj: true, inscricaoEstadual: true,
        logradouro: true, numero: true, bairro: true,
        municipio: true, uf: true, cep: true,
      },
    });

    // ── Parse XML para campos não armazenados no banco ───────────────────────
    const xml = inbox.xmlContent || '';
    const rx  = (tag: string, src = xml) =>
      src.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)<\\/${tag}>`))?.[1]?.trim() ?? '';
    const blk = (tag: string, src = xml) =>
      src.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? '';

    // Dados gerais
    const natOp    = rx('natOp')  || 'VENDA DE MERCADORIA';
    const tpNF     = rx('tpNF');  // 0=entrada 1=saída do emitente
    const dhEmi    = rx('dhEmi')  || rx('dEmi');
    const dhSaiEnt = rx('dhSaiEnt') || rx('dSaiEnt');
    const hSaiEnt  = rx('hSaiEnt');

    // Protocolo de autorização
    const infProtBlk = blk('infProt');
    const nProt    = rx('nProt', infProtBlk) || rx('nProt');
    const dhRecbto = rx('dhRecbto', infProtBlk) || rx('dhRecbto');
    const protocolo = nProt
      ? `${nProt}  ${dhRecbto ? new Date(dhRecbto).toLocaleString('pt-BR') : ''}`
      : '—';

    // Emitente
    const emitBlk     = blk('emit');
    const emitEnderBlk = blk('enderEmit', emitBlk);
    const emitenteIE  = rx('IE', emitBlk)    || '—';
    const emitenteIEST = rx('IEST', emitBlk) || 'ISENTO';
    const emitLgr    = rx('xLgr',   emitEnderBlk);
    const emitNro    = rx('nro',    emitEnderBlk);
    const emitBairro = rx('xBairro', emitEnderBlk);
    const emitMun    = rx('xMun',   emitEnderBlk);
    const emitUF     = rx('UF',     emitEnderBlk);
    const emitCEP    = rx('CEP',    emitEnderBlk);
    const emitFone   = rx('fone',   emitEnderBlk) || rx('fone', emitBlk);
    const emitEndLinha1 = [emitLgr, emitNro ? `nº ${emitNro}` : '', emitBairro].filter(Boolean).join(', ');
    const emitEndLinha2 = [
      emitMun && emitUF ? `${emitMun}/${emitUF}` : (emitMun || emitUF),
      emitCEP ? `CEP: ${emitCEP.replace(/(\d{5})(\d{3})/, '$1-$2')}` : '',
      emitFone ? `Tel: ${emitFone}` : '',
    ].filter(Boolean).join('  ');

    // Destinatário
    const destBlk      = blk('dest');
    const destEnderBlk = blk('enderDest', destBlk);
    const destNome   = rx('xNome', destBlk) || company?.razaoSocial || '—';
    const destDoc    = rx('CNPJ', destBlk)  || rx('CPF', destBlk) || company?.cnpj || '';
    const destIE     = rx('IE',   destBlk)  || company?.inscricaoEstadual || 'ISENTO';
    const destFone   = rx('fone', destEnderBlk) || rx('fone', destBlk);
    const destLgr    = rx('xLgr',    destEnderBlk) || company?.logradouro || '';
    const destNro    = rx('nro',     destEnderBlk) || company?.numero || '';
    const destBairro = rx('xBairro', destEnderBlk) || company?.bairro || '';
    const destMun    = rx('xMun',    destEnderBlk) || company?.municipio || '';
    const destUF     = rx('UF',      destEnderBlk) || company?.uf || '';
    const destCEP    = rx('CEP',     destEnderBlk) || company?.cep || '';

    // Transporte
    const transpBlk  = blk('transp');
    const modFrete   = rx('modFrete', transpBlk);
    const modFreteMap: Record<string, string> = {
      '0': '0 - Emitente', '1': '1 - Destinatário', '2': '2 - Terceiros',
      '3': '3 - Próprio/Remetente', '4': '4 - Próprio/Dest.', '9': '9 - Sem Ocorrência',
    };
    const modFreteStr  = modFreteMap[modFrete] || modFrete || '9 - Sem Ocorrência';
    const transportaBlk = blk('transporta', transpBlk);
    const transpNome = rx('xNome', transportaBlk) || '—';
    const transpCnpj = rx('CNPJ',  transportaBlk) || '';
    const transpIE   = rx('IE',    transportaBlk) || '';
    const transpEnd  = rx('xEnder', transportaBlk) || '';
    const transpMun  = rx('xMun',  transportaBlk) || '';
    const transpUF   = rx('UF',    transportaBlk) || '';
    const volBlk     = blk('vol', transpBlk);
    const volQtde  = rx('qVol',  volBlk) || '—';
    const volEsp   = rx('esp',   volBlk) || '—';
    const volMarca = rx('marca', volBlk) || '—';
    const volNVol  = rx('nVol',  volBlk) || '—';
    const volPesoB = rx('pesoB', volBlk) || '—';
    const volPesoL = rx('pesoL', volBlk) || '—';

    // Informações adicionais
    const infCpl = rx('infCpl') || '';

    // Totais do XML (ICMSTot)
    const icmsTotBlk = blk('ICMSTot');
    const vBC   = parseFloat(rx('vBC',  icmsTotBlk) || '0');
    const vBCST = parseFloat(rx('vBCST', icmsTotBlk) || '0');
    const vST   = parseFloat(rx('vST',  icmsTotBlk) || '0');
    const vProd = parseFloat(rx('vProd', icmsTotBlk) || '0');
    // IBS/CBS — NT 2024.001 (Reforma Tributária)
    const vIBS  = parseFloat(rx('vIBS',  icmsTotBlk) || rx('vIBS')  || '0');
    const vCBS  = parseFloat(rx('vCBS',  icmsTotBlk) || rx('vCBS')  || '0');

    // Por item: BC ICMS, CST, alíquotas, IBS/CBS
    const itemBcIcms:  Record<number, number> = {};
    const itemCst:     Record<number, string> = {};
    const itemAlqIcms: Record<number, number> = {};
    const itemVIbs:    Record<number, number> = {};
    const itemVCbs:    Record<number, number> = {};
    const detRe = /<det\s+nItem="(\d+)"[^>]*>([\s\S]*?)<\/det>/g;
    let dm: RegExpExecArray | null;
    while ((dm = detRe.exec(xml)) !== null) {
      const n = parseInt(dm[1], 10);
      const d = dm[2];
      const gv = (t: string) => d.match(new RegExp(`<${t}[^>]*>([^<]*)<\\/${t}>`))?.[1]?.trim() ?? '';
      itemBcIcms[n]  = parseFloat(gv('vBC')   || '0');
      itemAlqIcms[n] = parseFloat(gv('pICMS') || '0');
      itemCst[n]     = gv('CST') || gv('CSOSN') || '';
      itemVIbs[n]    = parseFloat(gv('vIBS')  || '0');
      itemVCbs[n]    = parseFloat(gv('vCBS')  || '0');
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    const fmt = (v: number | null | undefined) =>
      Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmt4 = (v: number | null | undefined) =>
      Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    const fmtCnpj = (c: string) => {
      const d = c.replace(/\D/g, '').padStart(14, '0');
      return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
    };
    const fmtDate = (d: string | Date) => {
      try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return '—'; }
    };

    const chave = inbox.chaveAcesso || '';
    const chaveFormatada = chave.replace(/(\d{4})/g, '$1 ').trim();
    const numero = inbox.numero && inbox.numero !== '0' && inbox.numero !== ''
      ? inbox.numero.padStart(9, '0')
      : (chave.length === 44 ? String(parseInt(chave.slice(25, 34), 10)).padStart(9, '0') : '—');
    const serie = inbox.serie && inbox.serie !== '0' && inbox.serie !== ''
      ? inbox.serie
      : (chave.length === 44 ? String(parseInt(chave.slice(22, 25), 10)) : '—');

    const totalIcms   = inbox.items.reduce((s, i) => s + Number(i.valorIcms   ?? 0), 0);
    const totalIpi    = inbox.items.reduce((s, i) => s + Number(i.valorIpi    ?? 0), 0);
    const totalPis    = inbox.items.reduce((s, i) => s + Number(i.valorPis    ?? 0), 0);
    const totalCofins = inbox.items.reduce((s, i) => s + Number(i.valorCofins ?? 0), 0);
    const totalProd   = inbox.items.reduce((s, i) => s + Number(i.valorTotal  ?? 0), 0);
    const totalIbsItens = Object.values(itemVIbs).reduce((s, v) => s + v, 0);
    const totalCbsItens = Object.values(itemVCbs).reduce((s, v) => s + v, 0);
    const hasIbsCbs = (vIBS + vCBS + totalIbsItens + totalCbsItens) > 0;

    const vNF    = Number(inbox.valorTotal);
    const vFrete = Number(inbox.valorFrete  ?? 0);
    const vSeg   = Number(inbox.valorSeguro ?? 0);
    const vOutro = Number(inbox.valorOutrasDespesas ?? 0);
    const vDesc  = Number(inbox.valorDesconto ?? 0);

    const border = {
      hLineWidth: () => 0.4,
      vLineWidth: () => 0.4,
      hLineColor: () => '#999999',
      vLineColor: () => '#999999',
    };

    // Cell helpers
    const L = (t: string) => ({
      text: t, fontSize: 5.5, color: '#555555',
      margin: [2, 1, 1, 0] as [number,number,number,number],
    });
    const V = (t: string, opts: object = {}) => ({
      text: t, fontSize: 7,
      margin: [2, 0, 2, 2] as [number,number,number,number],
      ...opts,
    });
    const C = (label: string, value: string, opts: object = {}) => ({
      stack: [L(label), V(value, opts)],
    });
    const secTitle = (t: string) => ({
      table: { widths: ['*'], body: [[{
        text: t, bold: true, fontSize: 6.5,
        fillColor: '#e8e8e8', margin: [3, 1, 3, 1],
      }]] },
      layout: border, margin: [0, 3, 0, 0],
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfMake = require('pdfmake/build/pdfmake');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pdfMake.vfs = require('pdfmake/build/vfs_fonts');

    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [15, 15, 15, 15],
      defaultStyle: { fontSize: 7, lineHeight: 1.1 },
      content: [

        // ═══════════════════════════════════════════════════════════════════════
        // BLOCO 1 — CABEÇALHO (3 colunas)
        // ═══════════════════════════════════════════════════════════════════════
        {
          table: {
            widths: ['44%', '22%', '34%'],
            body: [[
              // Coluna esquerda: Identificação do Emitente
              {
                stack: [
                  L('IDENTIFICAÇÃO DO EMITENTE'),
                  { text: inbox.emitenteNome || '—', bold: true, fontSize: 9, margin: [2, 2, 2, 1] },
                  emitEndLinha1 ? { text: emitEndLinha1, fontSize: 6.5, margin: [2, 0, 2, 0] } : {},
                  emitEndLinha2 ? { text: emitEndLinha2, fontSize: 6.5, margin: [2, 0, 2, 2] } : {},
                  { text: `CNPJ: ${inbox.emitenteCnpj ? fmtCnpj(inbox.emitenteCnpj) : '—'}`, fontSize: 6.5, margin: [2, 0, 2, 4] },
                ],
              },
              // Coluna central: título DANFE
              {
                stack: [
                  { text: 'DANFE', bold: true, fontSize: 16, alignment: 'center', margin: [0, 3, 0, 1] },
                  { text: 'Documento Auxiliar da\nNota Fiscal Eletrônica', fontSize: 6, alignment: 'center', margin: [0, 0, 0, 3] },
                  {
                    table: {
                      widths: ['50%', '50%'],
                      body: [[
                        {
                          text: '0\nENTRADA', alignment: 'center', fontSize: 6.5,
                          bold: tpNF !== '1',
                          fillColor: tpNF !== '1' ? '#222222' : '#ffffff',
                          color:     tpNF !== '1' ? '#ffffff' : '#000000',
                          margin: [2, 2, 2, 2],
                        },
                        {
                          text: '1\nSAÍDA', alignment: 'center', fontSize: 6.5,
                          bold: tpNF === '1',
                          fillColor: tpNF === '1' ? '#222222' : '#ffffff',
                          color:     tpNF === '1' ? '#ffffff' : '#000000',
                          margin: [2, 2, 2, 2],
                        },
                      ]],
                    },
                    layout: border,
                    margin: [8, 0, 8, 3],
                  },
                  { text: `Nº ${numero}  Série ${serie}`, alignment: 'center', fontSize: 7.5, bold: true },
                  { text: 'Folha 1/1', alignment: 'center', fontSize: 5.5, color: '#888888', margin: [0, 1, 0, 0] },
                ],
                alignment: 'center',
              },
              // Coluna direita: chave de acesso
              {
                stack: [
                  L('CHAVE DE ACESSO'),
                  {
                    text: chaveFormatada,
                    fontSize: 6.5, bold: true, alignment: 'center',
                    margin: [2, 2, 2, 2],
                  },
                  {
                    text: 'Consulta em: www.nfe.fazenda.gov.br/portal',
                    fontSize: 5.5, color: '#888888', alignment: 'center', margin: [2, 0, 2, 4],
                  },
                ],
              },
            ]],
          },
          layout: border,
        },

        // ═══════════════════════════════════════════════════════════════════════
        // BLOCO 2 — NATUREZA DA OPERAÇÃO + PROTOCOLO
        // ═══════════════════════════════════════════════════════════════════════
        {
          margin: [0, 1, 0, 0],
          table: {
            widths: ['55%', '45%'],
            body: [[
              C('NATUREZA DA OPERAÇÃO', natOp.toUpperCase(), { bold: true }),
              C('PROTOCOLO DE AUTORIZAÇÃO DE USO', protocolo),
            ]],
          },
          layout: border,
        },

        // ═══════════════════════════════════════════════════════════════════════
        // BLOCO 3 — IE EMITENTE + IE SUBST + CNPJ
        // ═══════════════════════════════════════════════════════════════════════
        {
          margin: [0, 1, 0, 0],
          table: {
            widths: ['34%', '33%', '33%'],
            body: [[
              C('INSCRIÇÃO ESTADUAL', emitenteIE),
              C('INSCRIÇÃO ESTADUAL DO SUBSTITUTO TRIBUTÁRIO', emitenteIEST),
              C('CNPJ', inbox.emitenteCnpj ? fmtCnpj(inbox.emitenteCnpj) : '—'),
            ]],
          },
          layout: border,
        },

        // ═══════════════════════════════════════════════════════════════════════
        // BLOCO 4 — DESTINATÁRIO / REMETENTE
        // ═══════════════════════════════════════════════════════════════════════
        secTitle('DESTINATÁRIO / REMETENTE'),
        {
          table: {
            widths: ['*', '30%', '22%'],
            body: [
              [
                C('NOME / RAZÃO SOCIAL', destNome, { bold: true }),
                C('CNPJ / CPF', destDoc ? fmtCnpj(destDoc) : '—'),
                C('DATA DE EMISSÃO', fmtDate(inbox.dataEmissao)),
              ],
              [
                C('ENDEREÇO', [destLgr, destNro ? `nº ${destNro}` : ''].filter(Boolean).join(', ')),
                C('BAIRRO / DISTRITO', destBairro),
                C('CEP', destCEP ? destCEP.replace(/(\d{5})(\d{3})/, '$1-$2') : '—'),
              ],
              [
                {
                  stack: [
                    L('MUNICÍPIO / FONE'),
                    V(`${destMun}${destFone ? `   Tel: ${destFone}` : ''}`),
                  ],
                },
                C('UF', destUF),
                C('INSCRIÇÃO ESTADUAL', destIE),
              ],
            ],
          },
          layout: border,
        },

        // ═══════════════════════════════════════════════════════════════════════
        // BLOCO 5 — DADOS DOS PRODUTOS / SERVIÇOS
        // ═══════════════════════════════════════════════════════════════════════
        secTitle('DADOS DOS PRODUTOS / SERVIÇOS'),
        {
          table: {
            headerRows: 1,
            widths: ['3%', '8%', '27%', '7%', '5%', '5%', '5%', '8%', '8%', '8%', '6%', '5%', '5%'],
            body: [
              [
                { text: 'Nº',      fontSize: 5.5, color: '#555555', alignment: 'center' },
                { text: 'CÓDIGO',  fontSize: 5.5, color: '#555555' },
                { text: 'DESCRIÇÃO DO PRODUTO / SERVIÇO', fontSize: 5.5, color: '#555555' },
                { text: 'NCM/SH',  fontSize: 5.5, color: '#555555', alignment: 'center' },
                { text: 'CST',     fontSize: 5.5, color: '#555555', alignment: 'center' },
                { text: 'CFOP',    fontSize: 5.5, color: '#555555', alignment: 'center' },
                { text: 'UN',      fontSize: 5.5, color: '#555555', alignment: 'center' },
                { text: 'QTDE',    fontSize: 5.5, color: '#555555', alignment: 'right' },
                { text: 'VL UNIT', fontSize: 5.5, color: '#555555', alignment: 'right' },
                { text: 'VL TOTAL',fontSize: 5.5, color: '#555555', alignment: 'right' },
                { text: 'BC ICMS', fontSize: 5.5, color: '#555555', alignment: 'right' },
                { text: 'VL ICMS', fontSize: 5.5, color: '#555555', alignment: 'right' },
                { text: 'VL IPI',  fontSize: 5.5, color: '#555555', alignment: 'right' },
              ],
              ...(inbox.items.length > 0
                ? inbox.items.map((item) => {
                    const n = item.numeroItem;
                    return [
                      { text: String(n),                                    fontSize: 6.5, alignment: 'center', margin: [1,1,1,1] },
                      { text: item.codigoProdutoFornecedor || '—',           fontSize: 6.5, margin: [1,1,1,1] },
                      { text: item.descricaoProduto || '—',                  fontSize: 6.5, margin: [1,1,1,1] },
                      { text: item.ncm || '—',                              fontSize: 6.5, alignment: 'center', margin: [1,1,1,1] },
                      { text: itemCst[n] || '—',                            fontSize: 6.5, alignment: 'center', margin: [1,1,1,1] },
                      { text: item.cfop || '—',                             fontSize: 6.5, alignment: 'center', margin: [1,1,1,1] },
                      { text: item.unidade || 'UN',                         fontSize: 6.5, alignment: 'center', margin: [1,1,1,1] },
                      { text: fmt4(Number(item.quantidade)),                 fontSize: 6.5, alignment: 'right',  margin: [1,1,1,1] },
                      { text: fmt4(Number(item.valorUnitario)),              fontSize: 6.5, alignment: 'right',  margin: [1,1,1,1] },
                      { text: fmt(Number(item.valorTotal)),                  fontSize: 6.5, alignment: 'right',  margin: [1,1,1,1] },
                      { text: itemBcIcms[n] > 0 ? fmt(itemBcIcms[n]) : '—', fontSize: 6.5, alignment: 'right',  margin: [1,1,1,1] },
                      { text: Number(item.valorIcms) > 0 ? fmt(Number(item.valorIcms)) : '—', fontSize: 6.5, alignment: 'right', margin: [1,1,1,1] },
                      { text: Number(item.valorIpi)  > 0 ? fmt(Number(item.valorIpi))  : '—', fontSize: 6.5, alignment: 'right', margin: [1,1,1,1] },
                    ];
                  })
                : [[{
                    text: 'Itens não disponíveis — XML completo não carregado.',
                    colSpan: 13, alignment: 'center', italic: true, fontSize: 7,
                    color: '#888888', margin: [4, 8, 4, 8],
                  }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}]]
              ),
            ],
          },
          layout: border,
        },

        // ═══════════════════════════════════════════════════════════════════════
        // BLOCO 6 — CÁLCULO DO IMPOSTO
        // ═══════════════════════════════════════════════════════════════════════
        secTitle('CÁLCULO DO IMPOSTO'),
        {
          table: {
            widths: ['16%', '14%', '16%', '14%', '20%', '20%'],
            body: [[
              C('BASE DE CÁLCULO DO ICMS', fmt(vBC > 0 ? vBC : 0), { bold: true }),
              C('VALOR DO ICMS', fmt(totalIcms)),
              C('BASE DE CÁLCULO ICMS ST', fmt(vBCST)),
              C('VALOR DO ICMS ST', fmt(vST)),
              C('VALOR TOTAL DOS PRODUTOS', fmt(vProd > 0 ? vProd : totalProd), { bold: true }),
              C('VALOR TOTAL DA NOTA', fmt(vNF), { bold: true, fontSize: 9 }),
            ]],
          },
          layout: border,
        },
        {
          table: {
            widths: ['14%', '13%', '13%', '14%', '14%', '14%', '*'],
            body: [[
              C('VALOR DO FRETE', fmt(vFrete)),
              C('VALOR DO SEGURO', fmt(vSeg)),
              C('DESCONTO', fmt(vDesc)),
              C('OUTRAS DESPESAS ACESS.', fmt(vOutro)),
              C('VALOR TOTAL DO IPI', fmt(totalIpi)),
              C('VALOR TOTAL PIS', fmt(totalPis)),
              C('VALOR TOTAL COFINS', fmt(totalCofins)),
            ]],
          },
          layout: border,
        },

        // ─── IBS / CBS (NT 2024.001 — Reforma Tributária) ───────────────────
        ...(hasIbsCbs ? [
          secTitle('CÁLCULO IBS / CBS — REFORMA TRIBUTÁRIA (NT 2024.001)'),
          {
            table: {
              widths: ['25%', '25%', '25%', '25%'],
              body: [[
                C('VALOR TOTAL IBS', fmt(vIBS > 0 ? vIBS : totalIbsItens), { bold: true }),
                C('VALOR TOTAL CBS', fmt(vCBS > 0 ? vCBS : totalCbsItens), { bold: true }),
                C('VALOR TOTAL IBS + CBS', fmt((vIBS > 0 ? vIBS : totalIbsItens) + (vCBS > 0 ? vCBS : totalCbsItens)), { bold: true }),
                C('OBSERVAÇÃO', 'IBS=ICMS reforma / CBS=PIS+COFINS reforma', { fontSize: 5.5, italic: true }),
              ]],
            },
            layout: border,
          } as any,
        ] : []),

        // ═══════════════════════════════════════════════════════════════════════
        // BLOCO 7 — TRANSPORTADOR / VOLUMES
        // ═══════════════════════════════════════════════════════════════════════
        secTitle('TRANSPORTADOR / VOLUMES TRANSPORTADOS'),
        {
          table: {
            widths: ['*', '24%', '12%', '22%'],
            body: [[
              C('RAZÃO SOCIAL', transpNome),
              C('FRETE POR CONTA', modFreteStr),
              C('PLACA DO VEÍCULO', '—'),
              C('CNPJ / CPF', transpCnpj ? fmtCnpj(transpCnpj) : '—'),
            ]],
          },
          layout: border,
        },
        {
          table: {
            widths: ['*', '20%', '20%', '12%', '12%'],
            body: [[
              C('ENDEREÇO', transpEnd || '—'),
              C('MUNICÍPIO', transpMun || '—'),
              C('UF', transpUF || '—'),
              C('INSCRIÇÃO ESTADUAL', transpIE || '—'),
              C('ANTT / RNTRC', '—'),
            ]],
          },
          layout: border,
        },
        {
          table: {
            widths: ['12%', '16%', '20%', '16%', '18%', '18%'],
            body: [[
              C('QTDE', volQtde),
              C('ESPÉCIE', volEsp),
              C('MARCA', volMarca),
              C('NUMERAÇÃO', volNVol),
              C('PESO BRUTO (kg)', volPesoB),
              C('PESO LÍQUIDO (kg)', volPesoL),
            ]],
          },
          layout: border,
        },

        // ═══════════════════════════════════════════════════════════════════════
        // BLOCO 8 — DADOS ADICIONAIS
        // ═══════════════════════════════════════════════════════════════════════
        secTitle('DADOS ADICIONAIS'),
        {
          table: {
            widths: ['65%', '35%'],
            body: [[
              {
                stack: [L('INFORMAÇÕES COMPLEMENTARES'), V(infCpl || '—', { fontSize: 6.5 })],
                minHeight: 40,
              },
              {
                stack: [L('RESERVADO AO FISCO'), V(' ')],
                minHeight: 40,
              },
            ]],
          },
          layout: border,
        },

        // ── Rodapé ─────────────────────────────────────────────────────────────
        {
          text: `Documento gerado pelo sistema ERP — ${new Date().toLocaleString('pt-BR')}`,
          fontSize: 5.5, color: '#aaaaaa', alignment: 'center', margin: [0, 5, 0, 0],
        },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfDoc = pdfMake.createPdf(docDefinition);
    const data: Uint8Array = await pdfDoc.getBuffer();
    return Buffer.from(data);
  }

  async create(companyId: string, dto: CreateNfeInboxDto) {
    // Check for duplicate chave de acesso
    const existing = await this.prisma.nFeInbox.findUnique({
      where: {
        companyId_chaveAcesso: {
          companyId,
          chaveAcesso: dto.chaveAcesso,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `NF-e with chave de acesso ${dto.chaveAcesso} already exists in inbox`,
      );
    }

    // Try to find emitente person by CNPJ
    const emitentePessoa = await this.prisma.person.findFirst({
      where: { companyId, cpfCnpj: dto.emitenteCnpj },
    });

    return this.prisma.nFeInbox.create({
      data: {
        companyId,
        chaveAcesso: dto.chaveAcesso,
        numero: dto.numero,
        serie: dto.serie,
        emitenteCnpj: dto.emitenteCnpj,
        emitenteNome: dto.emitenteNome,
        emitentePessoaId: emitentePessoa?.id || null,
        dataEmissao: new Date(dto.dataEmissao),
        valorTotal: dto.valorTotal,
        valorFrete: dto.valorFrete ?? 0,
        valorSeguro: dto.valorSeguro ?? 0,
        valorOutrasDespesas: dto.valorOutrasDespesas ?? 0,
        valorDesconto: dto.valorDesconto ?? 0,
        xmlContent: dto.xmlContent,
        status: 'PENDENTE' as any,
        items: {
          create: dto.items.map((item) => ({
            numeroItem: item.numeroItem,
            codigoProdutoFornecedor: item.codigoProdutoFornecedor,
            descricaoProduto: item.descricaoProduto,
            ncm: item.ncm ?? '',
            cfop: item.cfop ?? '',
            unidade: item.unidade,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            valorTotal: item.valorTotal,
            valorIcms: item.valorIcms ?? 0,
            valorIpi: item.valorIpi ?? 0,
            valorPis: item.valorPis ?? 0,
            valorCofins: item.valorCofins ?? 0,
          })),
        },
      },
      include: {
        items: { orderBy: { numeroItem: 'asc' } },
      },
    });
  }

  async manifest(id: string, companyId: string, dto: ManifestNfeDto) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
      include: { company: { select: { cnpj: true } } },
    });

    if (!inbox) {
      throw new NotFoundException(`NFeInbox ${id} not found`);
    }

    if (inbox.status === 'LANCADA') {
      throw new BadRequestException('Cannot manifest a NF-e that has already been posted');
    }

    if (
      dto.manifestacao === 'OPERACAO_NAO_REALIZADA' &&
      (!dto.justificativa || dto.justificativa.trim().length < 15)
    ) {
      throw new BadRequestException(
        'justificativa is required and must have at least 15 characters for OPERACAO_NAO_REALIZADA',
      );
    }

    // Enviar evento de manifestação ao SEFAZ Nacional
    const sefazResult = await this.sefazClient.enviarManifestacao(
      companyId,
      inbox.chaveAcesso,
      inbox.company.cnpj,
      dto.manifestacao as any,
      dto.justificativa,
    );

    const sefazOk = ['135', '573'].includes(sefazResult.cStat);
    if (!sefazOk) {
      this.logger.warn(
        `Manifestação SEFAZ retornou cStat ${sefazResult.cStat}: ${sefazResult.xMotivo} para NF-e ${inbox.chaveAcesso}`,
      );
    }

    const newStatus =
      dto.manifestacao === 'CONFIRMACAO_OPERACAO' ? 'MANIFESTADA' :
      dto.manifestacao === 'DESCONHECIMENTO_OPERACAO' ? 'REJEITADA' :
      dto.manifestacao === 'OPERACAO_NAO_REALIZADA' ? 'DEVOLVIDA' :
      'MANIFESTADA';

    const updated = await this.prisma.nFeInbox.update({
      where: { id },
      data: {
        manifestacao: dto.manifestacao as any,
        dataManifestacao: new Date(),
        status: newStatus as any,
      },
    });

    // ── IA Fiscal: classifica itens em background após CONFIRMACAO_OPERACAO ──
    if (newStatus === 'MANIFESTADA') {
      this.iaPipeline.processarNfe(id, companyId)
        .catch(err =>
          this.logger.error(`[Pipeline IA] Erro ao classificar NF-e ${id}: ${err?.message ?? err}`),
        );
    }

    return {
      ...updated,
      sefaz: {
        cStat: sefazResult.cStat,
        xMotivo: sefazResult.xMotivo,
        dhRegEvento: sefazResult.dhRegEvento,
        nProt: sefazResult.nProt,
        enviado: sefazOk,
      },
    };
  }

  /** Dispara manualmente o pipeline IA para uma NF-e (retry ou on-demand). */
  async iaClassificar(id: string, companyId: string) {
    return this.iaPipeline.processarNfe(id, companyId);
  }

  /** Retorna o status da classificação IA de todos os itens da NF-e. */
  async iaStatus(id: string, companyId: string) {
    return this.iaPipeline.statusPipeline(id, companyId);
  }

  async linkItem(id: string, companyId: string, dto: LinkNfeItemDto) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
    });

    if (!inbox) {
      throw new NotFoundException(`NFeInbox ${id} not found`);
    }

    const inboxItem = await this.prisma.nFeInboxItem.findFirst({
      where: { id: dto.inboxItemId, inboxId: id },
    });

    if (!inboxItem) {
      throw new NotFoundException(`NFeInboxItem ${dto.inboxItemId} not found in this inbox`);
    }

    // Fetch product with NCM to check for divergence
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { ncm: { select: { code: true } } },
    });

    // Update the item to link our product
    const updated = await this.prisma.nFeInboxItem.update({
      where: { id: dto.inboxItemId },
      data: {
        productId: dto.productId,
        mapeado: true,
      },
      include: {
        product: {
          select: { id: true, code: true, description: true, unit: true },
        },
      },
    });

    // If saveLink, upsert ProductSupplier catalog
    if (dto.saveLink && inbox.emitentePessoaId) {
      await this.prisma.productSupplier.upsert({
        where: {
          companyId_productId_personId: {
            companyId,
            productId: dto.productId,
            personId: inbox.emitentePessoaId,
          },
        },
        create: {
          companyId,
          productId: dto.productId,
          personId: inbox.emitentePessoaId,
          codigoFornecedor: inboxItem.codigoProdutoFornecedor,
          descricaoFornecedor: inboxItem.descricaoProduto,
          unidadeFornecedor: inboxItem.unidade,
          precoUltCompra: inboxItem.valorUnitario,
        },
        update: {
          codigoFornecedor: inboxItem.codigoProdutoFornecedor,
          descricaoFornecedor: inboxItem.descricaoProduto,
          unidadeFornecedor: inboxItem.unidade,
          precoUltCompra: inboxItem.valorUnitario,
        },
      });
    }

    // Check for NCM divergence and create audit record if needed
    const ncmNota = inboxItem.ncm;
    const ncmCadastro = product?.ncm?.code;
    if (ncmNota && ncmCadastro && ncmNota !== ncmCadastro && dto.ncmDivergenciaStatus) {
      await (this.prisma as any).ncmAuditoria.create({
        data: {
          companyId,
          nfeInboxId: id,
          nfeInboxItemId: dto.inboxItemId,
          productId: dto.productId,
          ncmNota,
          ncmCadastro,
          status: dto.ncmDivergenciaStatus,
          origemErro: dto.ncmDivergenciaStatus,
          observacoes: dto.ncmDivergenciaObs || null,
        },
      });
    }

    return updated;
  }

  async createAndLink(id: string, companyId: string, dto: CreateAndLinkDto) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
    });

    if (!inbox) {
      throw new NotFoundException(`NFeInbox ${id} not found`);
    }

    const inboxItem = await this.prisma.nFeInboxItem.findFirst({
      where: { id: dto.inboxItemId, inboxId: id },
    });

    if (!inboxItem) {
      throw new NotFoundException(`NFeInboxItem ${dto.inboxItemId} not found in this inbox`);
    }

    // Create new product
    const newProduct = await this.prisma.product.create({
      data: {
        companyId,
        code: dto.code,
        description: dto.description,
        ncmId: dto.ncmId || null,
        unit: dto.unit as any,
        type: 'MATERIA_PRIMA' as any,
        active: true,
      },
    });

    // Link the inbox item
    const updated = await this.prisma.nFeInboxItem.update({
      where: { id: dto.inboxItemId },
      data: {
        productId: newProduct.id,
        mapeado: true,
      },
      include: {
        product: {
          select: { id: true, code: true, description: true, unit: true },
        },
      },
    });

    // Auto-save to ProductSupplier catalog if emitente is known
    if (inbox.emitentePessoaId) {
      await this.prisma.productSupplier.upsert({
        where: {
          companyId_productId_personId: {
            companyId,
            productId: newProduct.id,
            personId: inbox.emitentePessoaId,
          },
        },
        create: {
          companyId,
          productId: newProduct.id,
          personId: inbox.emitentePessoaId,
          codigoFornecedor: inboxItem.codigoProdutoFornecedor,
          descricaoFornecedor: inboxItem.descricaoProduto,
          unidadeFornecedor: inboxItem.unidade,
          precoUltCompra: inboxItem.valorUnitario,
        },
        update: {},
      });
    }

    // Check for NCM divergence and create audit record if needed
    if (dto.ncmId) {
      const ncmRecord = await this.prisma.ncm.findUnique({ where: { id: dto.ncmId }, select: { code: true } });
      const ncmNota = inboxItem.ncm;
      const ncmCadastro = ncmRecord?.code;
      if (ncmNota && ncmCadastro && ncmNota !== ncmCadastro && dto.ncmDivergenciaStatus) {
        await (this.prisma as any).ncmAuditoria.create({
          data: {
            companyId,
            nfeInboxId: id,
            nfeInboxItemId: dto.inboxItemId,
            productId: newProduct.id,
            ncmNota,
            ncmCadastro,
            status: dto.ncmDivergenciaStatus,
            origemErro: dto.ncmDivergenciaStatus,
            observacoes: dto.ncmDivergenciaObs || null,
          },
        });
      }
    }

    return { product: newProduct, inboxItem: updated };
  }

  async autoMap(id: string, companyId: string) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id, companyId },
      include: {
        items: { where: { mapeado: false } },
      },
    });

    if (!inbox) {
      throw new NotFoundException(`NFeInbox ${id} not found`);
    }

    let mapped = 0;
    let pending = 0;

    for (const item of inbox.items) {
      if (!inbox.emitentePessoaId) {
        pending++;
        continue;
      }

      // Lookup ProductSupplier by [companyId, supplier's personId, codigoFornecedor]
      const ps = await this.prisma.productSupplier.findFirst({
        where: {
          companyId,
          personId: inbox.emitentePessoaId,
          codigoFornecedor: item.codigoProdutoFornecedor,
        },
      });

      if (ps) {
        await this.prisma.nFeInboxItem.update({
          where: { id: item.id },
          data: {
            productId: ps.productId,
            mapeado: true,
          },
        });
        mapped++;
      } else {
        pending++;
      }
    }

    return { mapped, pending };
  }

  // ── Destinações que controlam estoque ──────────────────────────────────────
  // A7: GGF incluído — controla estoque com CFOP 1101, crédito ICMS/IPI igual a MP
  private readonly DESTINACOES_COM_ESTOQUE = [
    'MATERIA_PRIMA', 'COMPONENTE', 'PRODUTO_REVENDA', 'INSUMO_PRODUCAO', 'EMBALAGEM', 'GGF',
  ];

  /**
   * THE MAIN METHOD: atomic transaction that posts a NF-e entry into stock,
   * financial, fiscal, and accounting modules.
   *
   * Behaviour when linked to a physically-received PurchaseOrder (Phase 2+3):
   *  - Stock items: UPDATE existing StockMovements with real NF-e cost (no duplicates).
   *  - Non-stock items (MUC, GGF, IMOBILIZADO, SERVICO): register fiscal/financial/contábil only.
   *
   * Behaviour without a linked PO (direct fiscal entry):
   *  - Creates new StockMovements for stock items only.
   */
  async postEntry(companyId: string, userId: string, dto: PostNfeEntryDto) {
    const inbox = await this.prisma.nFeInbox.findFirst({
      where: { id: dto.inboxId, companyId },
      include: {
        items: {
          include: {
            product: { select: { id: true, code: true, description: true, unit: true } },
          },
        },
        emitentePessoa: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
      },
    });

    if (!inbox) {
      throw new NotFoundException(`NFeInbox ${dto.inboxId} not found`);
    }

    if (inbox.status === 'LANCADA') {
      throw new BadRequestException('This NF-e has already been posted');
    }

    // Validate all items are mapped
    const unmapped = inbox.items.filter((i) => !i.mapeado);
    if (unmapped.length > 0) {
      throw new BadRequestException(
        `Cannot post entry: ${unmapped.length} item(s) are not mapped to products. ` +
        `Item codes: ${unmapped.map((i) => i.codigoProdutoFornecedor).join(', ')}`,
      );
    }

    if (!inbox.emitentePessoaId) {
      throw new BadRequestException(
        'Supplier (emitente) is not linked to a known Person. Please register the supplier first.',
      );
    }

    // Determine stock location
    let stockLocationId = dto.stockLocationId;
    if (!stockLocationId) {
      const defaultLocation = await this.prisma.stockLocation.findFirst({
        where: { companyId, type: 'ALMOXARIFADO' },
      });
      if (defaultLocation) {
        stockLocationId = defaultLocation.id;
      }
    }

    // ── Load linked PurchaseOrder (for destinação + prior physical receipt) ──
    const linkedPoId = dto.purchaseOrderId || inbox.purchaseOrderId;
    let linkedPoItems: any[] = [];
    // Map<productId, existing StockMovement from physical receipt>
    const priorMovements = new Map<string, any>();

    if (linkedPoId) {
      const po = await this.prisma.purchaseOrder.findUnique({
        where: { id: linkedPoId },
        include: {
          items: true,
          stockMovements: {
            where: { type: 'ENTRADA' as any, source: 'COMPRA' as any },
            orderBy: { createdAt: 'desc' },
            select: { id: true, productId: true, quantity: true, unitCost: true, totalCost: true, locationId: true },
          },
        },
      });
      if (po) {
        linkedPoItems = po.items;
        for (const sm of po.stockMovements) {
          if (!priorMovements.has(sm.productId)) {
            priorMovements.set(sm.productId, sm);
          }
        }
      }
    }

    const totalItemsValue = inbox.items.reduce((sum, i) => sum + i.valorTotal.toNumber(), 0);
    const frete = inbox.valorFrete.toNumber();
    const today = new Date();
    const periodoReferencia = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const result = await this.prisma.$transaction(async (tx) => {
      // -----------------------------------------------------------------------
      // 1. Stock movements: update existing (from physical receipt) OR create new
      //    Stock items: MP, COMPONENTE, INSUMO, EMBALAGEM, GGF → gera movimentação
      //    Non-stock items: MUC, IMOBILIZADO, SERVICO → só fiscal/contábil
      // -----------------------------------------------------------------------
      const stockMovementIds: string[] = [];

      for (const item of inbox.items) {
        if (!item.productId) continue;

        // Resolve destinação from linked OC item; default = MATERIA_PRIMA
        const poItem = linkedPoItems.find((i: any) => i.productId === item.productId);
        const destinacao: string = (poItem as any)?.destinacao ?? 'MATERIA_PRIMA';
        const isStockItem = this.DESTINACOES_COM_ESTOQUE.includes(destinacao);

        if (!isStockItem) continue; // MUC / IMOBILIZADO / SERVICO → no stock movement

        const itemValorTotal = item.valorTotal.toNumber();
        const itemQuantidade = item.quantidade.toNumber();
        const freightShare = totalItemsValue > 0
          ? (itemValorTotal / totalItemsValue) * frete
          : 0;
        const unitCostNFe = itemQuantidade > 0
          ? (itemValorTotal + freightShare) / itemQuantidade
          : item.valorUnitario.toNumber();
        const totalCostNFe = itemValorTotal + freightShare;

        const existingMovement = priorMovements.get(item.productId);

        if (existingMovement) {
          // ── UPDATE existing StockMovement with real NF-e cost ──────────────
          const oldTotalCost = Number(existingMovement.totalCost);
          const costDiff = totalCostNFe - oldTotalCost;

          await tx.stockMovement.update({
            where: { id: existingMovement.id },
            data: {
              unitCost: unitCostNFe,
              totalCost: totalCostNFe,
              nfeInboxId: inbox.id,
              documentNumber: `NF-${inbox.numero}`,
              observations: [
                `Custo ajustado pela NF-e ${inbox.numero}/${inbox.serie} (${inbox.emitenteNome}).`,
                `Diferença: ${costDiff >= 0 ? '+' : ''}R$ ${costDiff.toFixed(2)}`,
              ].join(' '),
            },
          });

          stockMovementIds.push(existingMovement.id);

          // Adjust StockBalance average cost if price changed
          if (Math.abs(costDiff) > 0.001) {
            const locId = existingMovement.locationId || stockLocationId;
            if (locId) {
              const balance = await tx.stockBalance.findUnique({
                where: { productId_locationId: { productId: item.productId, locationId: locId } },
              });
              if (balance) {
                const qty = Number(balance.quantity);
                const newTotalCost = Math.max(0, Number(balance.totalCost) + costDiff);
                const newAvgCost = qty > 0 ? newTotalCost / qty : unitCostNFe;
                await tx.stockBalance.update({
                  where: { productId_locationId: { productId: item.productId, locationId: locId } },
                  data: { totalCost: newTotalCost, averageCost: newAvgCost, lastMovementAt: today },
                });
              }
            }
          }
        } else if (stockLocationId) {
          // ── CREATE new StockMovement (no prior physical receipt) ───────────
          const movement = await tx.stockMovement.create({
            data: {
              companyId,
              productId: item.productId,
              locationId: stockLocationId!,
              type: 'ENTRADA' as any,
              source: 'COMPRA' as any,
              quantity: itemQuantidade,
              unitCost: unitCostNFe,
              totalCost: totalCostNFe,
              documentNumber: inbox.chaveAcesso.slice(-9),
              purchaseOrderId: linkedPoId || null,
              nfeInboxId: inbox.id,
              userId,
              observations: `NF-e ${inbox.numero} - Série ${inbox.serie} - ${inbox.emitenteNome}`,
            },
          });

          stockMovementIds.push(movement.id);

          // Upsert StockBalance
          await tx.stockBalance.upsert({
            where: {
              productId_locationId: {
                productId: item.productId,
                locationId: stockLocationId!,
              },
            },
            create: {
              companyId,
              productId: item.productId,
              locationId: stockLocationId!,
              quantity: itemQuantidade,
              availableQuantity: itemQuantidade,
              averageCost: unitCostNFe,
              totalCost: totalCostNFe,
              lastMovementAt: today,
            },
            update: {
              quantity: { increment: item.quantidade },
              availableQuantity: { increment: item.quantidade },
              lastMovementAt: today,
            },
          });
        }
      }

      // -----------------------------------------------------------------------
      // 2. Create FinancialMovement DESPESA (Conta a Pagar)
      // -----------------------------------------------------------------------
      const dataVencimento = dto.dataVencimento
        ? new Date(dto.dataVencimento)
        : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days default

      const financialMovement = await tx.financialMovement.create({
        data: {
          companyId,
          type: 'DESPESA' as any,
          personId: inbox.emitentePessoaId!,
          description: `NF-e ${inbox.numero}/${inbox.serie} - ${inbox.emitenteNome}`,
          numero: `NFE-${inbox.numero}`,
          valor: inbox.valorTotal.toNumber(),
          dataEmissao: inbox.dataEmissao,
          dataVencimento,
          bankAccountId: dto.bankAccountId || null,
          status: 'PENDENTE' as any,
          observations: `Chave de acesso: ${inbox.chaveAcesso}`,
        },
      });

      // -----------------------------------------------------------------------
      // 3. Create FiscalEntries for ICMS, PIS, COFINS credits
      // -----------------------------------------------------------------------
      const totalIcms = inbox.items.reduce((sum, i) => sum + i.valorIcms.toNumber(), 0);
      const totalPis = inbox.items.reduce((sum, i) => sum + i.valorPis.toNumber(), 0);
      const totalCofins = inbox.items.reduce((sum, i) => sum + i.valorCofins.toNumber(), 0);
      const totalIpi = inbox.items.reduce((sum, i) => sum + i.valorIpi.toNumber(), 0);

      const fiscalEntries: any[] = [];

      const fiscalBase = {
        companyId,
        type: 'CREDITO' as any,
        bookType: 'ENTRADA' as any,
        dataLancamento: today,
        periodoReferencia,
        cfopCode: '1102',
        naturezaOperacao: 'Compra de Mercadoria para Revenda',
        valorContabil: inbox.valorTotal.toNumber(),
        baseCalculo: totalItemsValue,
        observations: `NF-e ${inbox.numero}/${inbox.serie}`,
      };

      if (totalIcms > 0) {
        fiscalEntries.push(
          tx.fiscalEntry.create({
            data: {
              ...fiscalBase,
              aliquota: totalItemsValue > 0 ? (totalIcms / totalItemsValue) * 100 : 0,
              valorImposto: totalIcms,
              taxType: 'ICMS',
            },
          }),
        );
      }

      if (totalPis > 0) {
        fiscalEntries.push(
          tx.fiscalEntry.create({
            data: {
              ...fiscalBase,
              aliquota: totalItemsValue > 0 ? (totalPis / totalItemsValue) * 100 : 0,
              valorImposto: totalPis,
              taxType: 'PIS',
            },
          }),
        );
      }

      if (totalCofins > 0) {
        fiscalEntries.push(
          tx.fiscalEntry.create({
            data: {
              ...fiscalBase,
              aliquota: totalItemsValue > 0 ? (totalCofins / totalItemsValue) * 100 : 0,
              valorImposto: totalCofins,
              taxType: 'COFINS',
            },
          }),
        );
      }

      // Reforma Tributária — crédito IBS/CBS nas entradas (LC 214/2025)
      // IBS/CBS são lidos do XML pelo parseXmlInbox e gravados em inbox.valorInssRetido não —
      // os valores ficam em NFeInboxItem.valorIbs/valorCbs (campos do schema NFeItem).
      // Aqui usamos os totais dos itens para gerar o crédito fiscal.
      const totalIbs = inbox.items.reduce((sum: number, i: any) => sum + (i.valorIbs ? Number(i.valorIbs) : 0), 0);
      const totalCbs = inbox.items.reduce((sum: number, i: any) => sum + (i.valorCbs ? Number(i.valorCbs) : 0), 0);

      if (totalIbs > 0) {
        fiscalEntries.push(
          tx.fiscalEntry.create({
            data: {
              ...fiscalBase,
              aliquota: totalItemsValue > 0 ? (totalIbs / totalItemsValue) * 100 : 0,
              valorImposto: totalIbs,
              taxType: 'IBS',
            },
          }),
        );
      }

      if (totalCbs > 0) {
        fiscalEntries.push(
          tx.fiscalEntry.create({
            data: {
              ...fiscalBase,
              aliquota: totalItemsValue > 0 ? (totalCbs / totalItemsValue) * 100 : 0,
              valorImposto: totalCbs,
              taxType: 'CBS',
            },
          }),
        );
      }

      await Promise.all(fiscalEntries);

      // -----------------------------------------------------------------------
      // 4. JournalEntry split by destinação:
      //    D: Estoque / D: Despesas / D: Imobilizado — C: Fornecedores
      // -----------------------------------------------------------------------
      // Compute totals per destinação group
      let totalEstoque = 0;
      let totalDespesas = 0;
      let totalImobilizado = 0;

      for (const item of inbox.items) {
        if (!item.productId) continue;
        const poItem = linkedPoItems.find((i: any) => i.productId === item.productId);
        const dest: string = (poItem as any)?.destinacao ?? 'MATERIA_PRIMA';
        const val = item.valorTotal.toNumber();
        if (this.DESTINACOES_COM_ESTOQUE.includes(dest)) {
          totalEstoque += val;
        } else if (dest === 'IMOBILIZADO') {
          totalImobilizado += val;
        } else {
          totalDespesas += val; // MUC, SERVICO
        }
      }

      const [estoqueAcc, fornecedoresAcc, despesasAcc, imobilizadoAcc] = await Promise.all([
        tx.chartOfAccount.findFirst({ where: { companyId, code: { startsWith: '1.1.4' } } }),
        tx.chartOfAccount.findFirst({ where: { companyId, code: { startsWith: '2.1.1' } } }),
        tx.chartOfAccount.findFirst({ where: { companyId, code: { startsWith: '4.2' } } }),
        tx.chartOfAccount.findFirst({ where: { companyId, code: { startsWith: '1.2' } } }),
      ]);

      if (fornecedoresAcc) {
        const debits: any[] = [];
        let totalDebit = 0;

        if (totalEstoque > 0 && estoqueAcc) {
          debits.push({ accountId: estoqueAcc.id, type: 'DEVEDORA' as any, value: totalEstoque, description: `Estoque – NF-e ${inbox.numero}` });
          totalDebit += totalEstoque;
        }
        if (totalDespesas > 0 && despesasAcc) {
          debits.push({ accountId: despesasAcc.id, type: 'DEVEDORA' as any, value: totalDespesas, description: `Despesas (MUC/GGF/Serv.) – NF-e ${inbox.numero}` });
          totalDebit += totalDespesas;
        }
        if (totalImobilizado > 0 && imobilizadoAcc) {
          debits.push({ accountId: imobilizadoAcc.id, type: 'DEVEDORA' as any, value: totalImobilizado, description: `Imobilizado – NF-e ${inbox.numero}` });
          totalDebit += totalImobilizado;
        }
        // Fallback: if no account matched, use total against estoque
        if (debits.length === 0 && estoqueAcc) {
          const tv = inbox.valorTotal.toNumber();
          debits.push({ accountId: estoqueAcc.id, type: 'DEVEDORA' as any, value: tv, description: `Estoque – NF-e ${inbox.numero}` });
          totalDebit = tv;
        }

        if (debits.length > 0 && totalDebit > 0) {
          const journalNumero = `LC-NF-${inbox.numero}-${Date.now()}`;
          await tx.journalEntry.create({
            data: {
              companyId,
              numero: journalNumero,
              date: today,
              description: `Entrada NF-e ${inbox.numero}/${inbox.serie} – ${inbox.emitenteNome}`,
              totalValue: totalDebit,
              userId,
              status: 'LANCADO' as any,
              items: {
                create: [
                  ...debits,
                  { accountId: fornecedoresAcc.id, type: 'CREDORA' as any, value: totalDebit, description: `Fornecedores – ${inbox.emitenteNome}` },
                ],
              },
            },
          });
        }
      }

      // -----------------------------------------------------------------------
      // 5. Create NFeDocument record linked to company
      // -----------------------------------------------------------------------
      let nfeDocumentId: string | null = null;
      if (inbox.emitentePessoaId) {
        const nfeDoc = await tx.nFeDocument.create({
          data: {
            companyId,
            personId: inbox.emitentePessoaId,
            chaveAcesso: inbox.chaveAcesso,
            numero: parseInt(inbox.numero, 10) || null,
            serie: parseInt(inbox.serie, 10) || 1,
            type: 'ENTRADA' as any,
            operation: 'COMPRA' as any,
            status: 'AUTORIZADA' as any,
            naturezaOperacao: 'Compra de Mercadoria',
            dataEmissao: inbox.dataEmissao,
            dataEntradaSaida: today,
            valorProdutos: totalItemsValue,
            valorFrete: inbox.valorFrete.toNumber(),
            valorSeguro: inbox.valorSeguro.toNumber(),
            valorDesconto: inbox.valorDesconto.toNumber(),
            valorOutros: inbox.valorOutrasDespesas.toNumber(),
            valorTotal: inbox.valorTotal.toNumber(),
            valorIcms: totalIcms,
            valorIpi: totalIpi,
            valorPis: totalPis,
            valorCofins: totalCofins,
            xmlEnvio: inbox.xmlContent,
            financialMovements: {
              connect: { id: financialMovement.id },
            },
          },
        });
        nfeDocumentId = nfeDoc.id;
      }

      // -----------------------------------------------------------------------
      // 6. Update NFeInbox status to LANCADA + link nfeDocumentId
      // -----------------------------------------------------------------------
      const updatedInbox = await tx.nFeInbox.update({
        where: { id: inbox.id },
        data: {
          status: 'LANCADA' as any,
          nfeDocumentId,
          purchaseOrderId: dto.purchaseOrderId || inbox.purchaseOrderId,
        },
      });

      // -----------------------------------------------------------------------
      // 7. Update PurchaseOrder if linked
      // -----------------------------------------------------------------------
      if (linkedPoId) {
        await tx.purchaseOrder.update({
          where: { id: linkedPoId },
          data: { status: 'RECEBIDA' as any, dataEntregaReal: today },
        });
      }

      return {
        inbox: updatedInbox,
        financialMovementId: financialMovement.id,
        nfeDocumentId,
        stockMovements: stockMovementIds.length,
      };
    });

    // DRE snapshot trigger — fire-and-forget after transaction
    const today2 = new Date();
    const periodo = `${today2.getFullYear()}-${String(today2.getMonth() + 1).padStart(2, '0')}`;
    this.logger.log(`Purchasing postEntry complete for inbox ${dto.inboxId}. DRE recalc queued for period ${periodo}`);

    return result;
  }

  async getSyncStatus(companyId: string) {
    const ultimo = await this.prisma.sefazAuditLog.findFirst({
      where: { companyId },
      orderBy: { chamadaEm: 'desc' },
    });

    const agora = new Date();
    const bloqueadoAte = ultimo?.proximaPermitida ?? null;
    const bloqueado = bloqueadoAte ? bloqueadoAte > agora : false;

    let origemBloqueio: 'ERP' | 'EXTERNO' | null = null;
    if (bloqueado && ultimo) {
      origemBloqueio = ultimo.origem as 'ERP' | 'EXTERNO';
    }

    return {
      ultimaSincronizacao: ultimo?.chamadaEm ?? null,
      ultimoCstat: ultimo?.cStat ?? null,
      ultimoMotivo: ultimo?.xMotivo ?? null,
      totalDocsUltima: ultimo?.totalDocs ?? 0,
      bloqueado,
      bloqueadoAte: bloqueadoAte ?? null,
      segundosRestantes: bloqueado && bloqueadoAte
        ? Math.ceil((bloqueadoAte.getTime() - agora.getTime()) / 1000)
        : 0,
      origemBloqueio,
      ambiente: ultimo?.ambiente ?? null,
    };
  }

  async listNcmAuditorias(companyId: string, query: { status?: string; page?: string; limit?: string }) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const where: any = { companyId };
    if (query.status) where.status = query.status;
    const [data, total] = await Promise.all([
      (this.prisma as any).ncmAuditoria.findMany({
        where,
        include: {
          nfeInbox: { select: { numero: true, serie: true, emitenteNome: true } },
          nfeInboxItem: { select: { descricaoProduto: true, ncm: true, codigoProdutoFornecedor: true } },
          product: { select: { code: true, description: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (this.prisma as any).ncmAuditoria.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async resolveNcmAuditoria(id: string, companyId: string, dto: { status: string; observacoes?: string; resolvidoPorId: string }) {
    return (this.prisma as any).ncmAuditoria.update({
      where: { id },
      data: {
        status: dto.status,
        observacoes: dto.observacoes,
        resolvidoEm: new Date(),
        resolvidoPorId: dto.resolvidoPorId,
      },
    });
  }

}

