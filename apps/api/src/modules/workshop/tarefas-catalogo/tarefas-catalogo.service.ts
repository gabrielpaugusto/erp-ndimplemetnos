import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class TarefasCatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, query: { contexto?: string; ativo?: string; search?: string }) {
    const where: any = { companyId };
    if (query.contexto) where.contexto = query.contexto;
    if (query.ativo !== undefined) where.ativo = query.ativo !== 'false';
    if (query.search) where.nome = { contains: query.search, mode: 'insensitive' };

    const tarefas = await this.prisma.tarefaCatalogo.findMany({
      where,
      include: {
        subtarefas: { orderBy: { ordem: 'asc' } },
        _count: { select: { osTarefas: true, opTarefas: true } },
      },
      orderBy: [{ contexto: 'asc' }, { codigo: 'asc' }],
    });

    // Calcula tempo padrão efetivo (soma subtarefas se existirem)
    return tarefas.map((t) => ({
      ...t,
      tempoPadraoEfetivoH: t.subtarefas.length > 0
        ? t.subtarefas.reduce((sum, s) => sum + s.tempoPadraoH, 0)
        : (t.tempoPadraoH ?? 0),
    }));
  }

  async findOne(id: string) {
    const tarefa = await this.prisma.tarefaCatalogo.findUnique({
      where: { id },
      include: { subtarefas: { orderBy: { ordem: 'asc' } } },
    });
    if (!tarefa) throw new NotFoundException(`Tarefa ${id} não encontrada`);
    return tarefa;
  }

  async create(companyId: string, data: {
    codigo: string;
    nome: string;
    contexto: 'SERVICO' | 'PRODUCAO';
    tempoPadraoH?: number;
    observations?: string;
  }) {
    return this.prisma.tarefaCatalogo.create({
      data: { companyId, ...data },
      include: { subtarefas: true },
    });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.tarefaCatalogo.update({
      where: { id },
      data,
      include: { subtarefas: { orderBy: { ordem: 'asc' } } },
    });
  }

  // ── Subtarefas ────────────────────────────────────────────────────────────

  async createSubtarefa(tarefaCatalogoId: string, data: {
    nome: string;
    tempoPadraoH: number;
    ordem?: number;
    observations?: string;
  }) {
    await this.findOne(tarefaCatalogoId);

    // Ordem automática se não informada
    if (data.ordem === undefined) {
      const last = await this.prisma.subtarefaCatalogo.findFirst({
        where: { tarefaCatalogoId },
        orderBy: { ordem: 'desc' },
      });
      data.ordem = (last?.ordem ?? 0) + 10;
    }

    return this.prisma.subtarefaCatalogo.create({
      data: { tarefaCatalogoId, ...data },
    });
  }

  async updateSubtarefa(id: string, data: any) {
    return this.prisma.subtarefaCatalogo.update({ where: { id }, data });
  }

  async deleteSubtarefa(id: string) {
    return this.prisma.subtarefaCatalogo.delete({ where: { id } });
  }

  // ── Adicionar tarefas do catálogo a uma OS (cria snapshots) ───────────────

  async adicionarNaOS(serviceOrderId: string, tarefaCatalogoId: string) {
    const tarefa = await this.prisma.tarefaCatalogo.findUnique({
      where: { id: tarefaCatalogoId },
      include: { subtarefas: { orderBy: { ordem: 'asc' } } },
    });
    if (!tarefa) throw new NotFoundException('Tarefa não encontrada no catálogo');

    const tempoPadraoH = tarefa.subtarefas.length > 0
      ? tarefa.subtarefas.reduce((s, sub) => s + sub.tempoPadraoH, 0)
      : (tarefa.tempoPadraoH ?? 0);

    // Ordem da tarefa na OS
    const lastOsTarefa = await this.prisma.osTarefa.findFirst({
      where: { serviceOrderId },
      orderBy: { ordem: 'desc' },
    });
    const ordem = (lastOsTarefa?.ordem ?? 0) + 10;

    return this.prisma.osTarefa.create({
      data: {
        serviceOrderId,
        tarefaCatalogoId,
        titulo: tarefa.nome,
        tempoPadraoH,
        ordem,
        subtarefas: {
          create: tarefa.subtarefas.map((sub) => ({
            subtarefaCatalogoId: sub.id,
            nome: sub.nome,
            tempoPadraoH: sub.tempoPadraoH,
            ordem: sub.ordem,
          })),
        },
      },
      include: { subtarefas: { orderBy: { ordem: 'asc' } } },
    });
  }

  async adicionarNaOP(productionOrderId: string, tarefaCatalogoId: string) {
    const tarefa = await this.prisma.tarefaCatalogo.findUnique({
      where: { id: tarefaCatalogoId },
      include: { subtarefas: { orderBy: { ordem: 'asc' } } },
    });
    if (!tarefa) throw new NotFoundException('Tarefa não encontrada no catálogo');

    const tempoPadraoH = tarefa.subtarefas.length > 0
      ? tarefa.subtarefas.reduce((s, sub) => s + sub.tempoPadraoH, 0)
      : (tarefa.tempoPadraoH ?? 0);

    const lastOpTarefa = await this.prisma.opTarefa.findFirst({
      where: { productionOrderId },
      orderBy: { ordem: 'desc' },
    });
    const ordem = (lastOpTarefa?.ordem ?? 0) + 10;

    return this.prisma.opTarefa.create({
      data: {
        productionOrderId,
        tarefaCatalogoId,
        titulo: tarefa.nome,
        tempoPadraoH,
        ordem,
        subtarefas: {
          create: tarefa.subtarefas.map((sub) => ({
            subtarefaCatalogoId: sub.id,
            nome: sub.nome,
            tempoPadraoH: sub.tempoPadraoH,
            ordem: sub.ordem,
          })),
        },
      },
      include: { subtarefas: { orderBy: { ordem: 'asc' } } },
    });
  }
}
