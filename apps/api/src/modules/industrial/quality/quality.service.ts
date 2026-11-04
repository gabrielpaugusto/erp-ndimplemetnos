import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class QualityService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, query: any) {
    const { status, type, productionOrderId, page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { companyId };
    if (status) where.status = status;
    if (type) where.type = type;
    if (productionOrderId) where.productionOrderId = productionOrderId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.qualityInspection.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { dataInspecao: 'desc' },
        include: {
          product: { select: { id: true, description: true, code: true } },
          productionOrder: { select: { id: true, numero: true } },
          responsavel: { select: { id: true, name: true } },
        },
      }),
      this.prisma.qualityInspection.count({ where }),
    ]);

    return { data, meta: { total, page: Number(page), limit: Number(limit) } };
  }

  async findOne(id: string, companyId: string) {
    const record = await this.prisma.qualityInspection.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, description: true, code: true } },
        productionOrder: { select: { id: true, numero: true } },
        responsavel: { select: { id: true, name: true } },
      },
    });
    if (!record || record.companyId !== companyId) throw new NotFoundException('Inspeção não encontrada');
    return record;
  }

  async create(companyId: string, userId: string, body: any) {
    const last = await this.prisma.qualityInspection.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { numero: true },
    });
    const seq = last
      ? parseInt(last.numero.split('-').pop() ?? '0', 10) + 1
      : 1;
    const numero = `IQ-${new Date().getFullYear()}-${seq.toString().padStart(4, '0')}`;

    return this.prisma.qualityInspection.create({
      data: {
        companyId,
        numero,
        type: body.type,
        status: body.status ?? 'PENDENTE',
        productionOrderId: body.productionOrderId ?? null,
        productId: body.productId ?? null,
        quantidadeInspecionada: body.quantidadeInspecionada ?? 0,
        quantidadeAprovada: body.quantidadeAprovada ?? 0,
        quantidadeReprovada: body.quantidadeReprovada ?? 0,
        observacoes: body.observacoes ?? null,
        acaoCorretiva: body.acaoCorretiva ?? null,
        responsavelId: body.responsavelId ?? userId,
        dataInspecao: body.dataInspecao ? new Date(body.dataInspecao) : new Date(),
      },
    });
  }

  async update(id: string, companyId: string, body: any) {
    await this.findOne(id, companyId);
    return this.prisma.qualityInspection.update({
      where: { id },
      data: {
        status: body.status,
        quantidadeInspecionada: body.quantidadeInspecionada,
        quantidadeAprovada: body.quantidadeAprovada,
        quantidadeReprovada: body.quantidadeReprovada,
        observacoes: body.observacoes,
        acaoCorretiva: body.acaoCorretiva,
        responsavelId: body.responsavelId,
        dataInspecao: body.dataInspecao ? new Date(body.dataInspecao) : undefined,
      },
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.qualityInspection.delete({ where: { id } });
  }

  async stats(companyId: string) {
    const [total, pendentes, aprovadas, reprovadas] = await this.prisma.$transaction([
      this.prisma.qualityInspection.count({ where: { companyId } }),
      this.prisma.qualityInspection.count({ where: { companyId, status: 'PENDENTE' } }),
      this.prisma.qualityInspection.count({ where: { companyId, status: 'APROVADA' } }),
      this.prisma.qualityInspection.count({ where: { companyId, status: 'REPROVADA' } }),
    ]);
    return { total, pendentes, aprovadas, reprovadas };
  }
}
