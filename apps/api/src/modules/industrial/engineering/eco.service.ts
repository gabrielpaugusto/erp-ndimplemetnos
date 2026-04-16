import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { DocumentEventService } from '@/modules/core/audit/document-event.service';
import { CreateEcoDto, UpdateEcoStatusDto } from './dto/create-eco.dto';

/**
 * Sprint 3.2 — ECO Leve (Engineering Change Order)
 *
 * Filosofia: NÃO bloqueia a produção.
 * Gera rastreabilidade formal da mudança e registra na timeline dos documentos afetados.
 */
@Injectable()
export class EcoService {
  private readonly logger = new Logger(EcoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentEvents: DocumentEventService,
  ) {}

  async findAll(
    companyId: string,
    query: { status?: string; tipo?: string; page?: string; limit?: string },
  ) {
    const page  = parseInt(query.page  || '1',  10);
    const limit = parseInt(query.limit || '20', 10);
    const skip  = (page - 1) * limit;
    const where: any = { companyId };

    if (query.status) where.status = query.status;
    if (query.tipo)   where.tipo   = query.tipo;

    const [data, total] = await Promise.all([
      this.prisma.engineeringChange.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          solicitante: { select: { id: true, name: true } },
          aprovador:   { select: { id: true, name: true } },
        },
      }),
      this.prisma.engineeringChange.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string, companyId: string) {
    const eco = await this.prisma.engineeringChange.findFirst({
      where: { id, companyId },
      include: {
        solicitante: { select: { id: true, name: true } },
        aprovador:   { select: { id: true, name: true } },
      },
    });
    if (!eco) throw new NotFoundException(`ECO ${id} não encontrado`);
    return eco;
  }

  async create(companyId: string, userId: string, dto: CreateEcoDto) {
    const numero = await this._gerarNumero(companyId);

    const eco = await this.prisma.engineeringChange.create({
      data: {
        companyId,
        numero,
        tipo:              dto.tipo as any,
        status:            'RASCUNHO',
        descricao:         dto.descricao,
        motivoTecnico:     dto.motivoTecnico,
        impactoEstoque:    dto.impactoEstoque ?? false,
        impactoCusto:      dto.impactoCusto   ?? false,
        documentosAfetados: (dto.documentosAfetados ?? []) as any,
        solicitanteId:     userId,
      },
      include: {
        solicitante: { select: { id: true, name: true } },
      },
    });

    // Registra na timeline de cada documento afetado (fire-and-forget)
    for (const doc of dto.documentosAfetados ?? []) {
      this.documentEvents.record({
        companyId,
        entityType: doc.type,
        entityId:   doc.id,
        eventType:  'ALERTA_GERADO',
        description: `ECO ${numero} registrado: ${dto.descricao.substring(0, 80)}`,
        userId,
      });
    }

    return eco;
  }

  async updateStatus(id: string, companyId: string, userId: string, dto: UpdateEcoStatusDto) {
    const eco = await this.findOne(id, companyId);

    const transitions: Record<string, string[]> = {
      RASCUNHO:    ['APROVADO', 'CANCELADO'],
      APROVADO:    ['IMPLEMENTADO', 'CANCELADO'],
      IMPLEMENTADO: [],
      CANCELADO:   [],
    };

    if (!transitions[eco.status as string]?.includes(dto.status)) {
      throw new BadRequestException(
        `Transição inválida: ${eco.status} → ${dto.status}`,
      );
    }

    const updated = await this.prisma.engineeringChange.update({
      where: { id },
      data: {
        status:         dto.status as any,
        aprovadorId:    dto.status === 'APROVADO' ? userId : undefined,
        implementadoEm: dto.status === 'IMPLEMENTADO' ? new Date() : undefined,
      },
    });

    // Notifica os documentos afetados na timeline
    const docs = (eco.documentosAfetados as any[]) ?? [];
    for (const doc of docs) {
      this.documentEvents.record({
        companyId,
        entityType: doc.type,
        entityId:   doc.id,
        eventType:  'ALERTA_GERADO',
        description: `ECO ${eco.numero} → status alterado para ${dto.status}`,
        userId,
      });
    }

    return updated;
  }

  private async _gerarNumero(companyId: string): Promise<string> {
    const today   = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const prefix  = `ECO-${dateStr}-`;

    const last = await this.prisma.engineeringChange.findFirst({
      where: { companyId, numero: { startsWith: prefix } },
      orderBy: { numero: 'desc' },
    });

    let seq = 1;
    if (last) {
      const parsed = parseInt(last.numero.replace(prefix, ''), 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }
}
