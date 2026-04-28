import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class ApontamentosOsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── START ─────────────────────────────────────────────────────────────────
  // Regra de exclusividade: funcionário só pode ter 1 apontamento aberto por vez.
  // Se subtarefa tem apontamento pausado → RETOMA (não cria novo).
  // Se tem outro apontamento aberto (qualquer) → BLOQUEIA.

  async start(osSubtarefaId: string, employeeId: string, companyId: string) {
    const subtarefa = await this.prisma.osSubtarefa.findUnique({
      where: { id: osSubtarefaId },
      include: { osTarefa: { select: { serviceOrderId: true } } },
    });
    if (!subtarefa) throw new NotFoundException('Subtarefa não encontrada');

    // Verifica se já tem um apontamento PAUSADO nesta subtarefa (RETOMA)
    const pausado = await this.prisma.apontamento.findFirst({
      where: { osSubtarefaId, employeeId, fim: null, pausado: true },
    });

    if (pausado) {
      // RETOMA: abre novo segmento, marca como ativo
      await this.prisma.apontamento.update({
        where: { id: pausado.id },
        data: { pausado: false },
      });
      await this.prisma.apontamentoSegmento.create({
        data: { apontamentoId: pausado.id, inicio: new Date() },
      });
      return this.getApontamentoAtual(osSubtarefaId, employeeId);
    }

    // Verifica exclusividade: algum outro apontamento aberto?
    const aberto = await this.prisma.apontamento.findFirst({
      where: { employeeId, fim: null, companyId },
      include: {
        osSubtarefa: { select: { nome: true } },
        opSubtarefa: { select: { nome: true } },
      },
    });

    if (aberto) {
      const nomeTarefa = aberto.osSubtarefa?.nome || aberto.opSubtarefa?.nome || 'outra tarefa';
      throw new BadRequestException(
        `Funcionário já possui apontamento aberto em "${nomeTarefa}". Pause ou finalize antes de iniciar outro.`,
      );
    }

    // NOVO APONTAMENTO
    const apontamento = await this.prisma.apontamento.create({
      data: {
        companyId,
        employeeId,
        osSubtarefaId,
        serviceOrderId: subtarefa.osTarefa.serviceOrderId,
        inicio: new Date(),
        status: 'EM_ANDAMENTO',
      },
    });

    await this.prisma.apontamentoSegmento.create({
      data: { apontamentoId: apontamento.id, inicio: new Date() },
    });

    // Atualiza status da subtarefa
    await this.prisma.osSubtarefa.update({
      where: { id: osSubtarefaId },
      data: { status: 'EM_EXECUCAO' },
    });

    return this.getApontamentoAtual(osSubtarefaId, employeeId);
  }

  // ── PAUSE ─────────────────────────────────────────────────────────────────

  async pause(osSubtarefaId: string, employeeId: string) {
    const apontamento = await this.prisma.apontamento.findFirst({
      where: { osSubtarefaId, employeeId, fim: null, pausado: false },
    });
    if (!apontamento) throw new NotFoundException('Nenhum apontamento ativo para esta subtarefa');

    // Fecha o segmento atual
    await this.fecharSegmentoAtivo(apontamento.id);

    await this.prisma.apontamento.update({
      where: { id: apontamento.id },
      data: { pausado: true },
    });

    return this.getApontamentoAtual(osSubtarefaId, employeeId);
  }

  // ── STOP ──────────────────────────────────────────────────────────────────

  async stop(osSubtarefaId: string, employeeId: string) {
    const apontamento = await this.prisma.apontamento.findFirst({
      where: { osSubtarefaId, employeeId, fim: null },
      include: { segmentos: true },
    });
    if (!apontamento) throw new NotFoundException('Nenhum apontamento aberto para esta subtarefa');

    // Fecha segmento ativo se existir
    if (!apontamento.pausado) {
      await this.fecharSegmentoAtivo(apontamento.id);
    }

    // Recalcula total de horas (soma de todos os segmentos fechados)
    const segmentos = await this.prisma.apontamentoSegmento.findMany({
      where: { apontamentoId: apontamento.id, fim: { not: null } },
    });
    const totalHoras = segmentos.reduce((sum, s) => sum + Number(s.horas ?? 0), 0);

    const agora = new Date();
    await this.prisma.apontamento.update({
      where: { id: apontamento.id },
      data: {
        fim: agora,
        pausado: false,
        totalHoras: totalHoras,
        status: 'CONCLUIDO',
      },
    });

    // Atualiza horasApontadas acumuladas na subtarefa
    const totalAcumulado = await this.calcularHorasAcumuladas(osSubtarefaId);
    await this.prisma.osSubtarefa.update({
      where: { id: osSubtarefaId },
      data: { horasApontadas: totalAcumulado },
    });

    return { success: true, totalHoras };
  }

  // ── Painel Ao Vivo ────────────────────────────────────────────────────────

  async getPainelAoVivo(companyId: string) {
    // Todos os apontamentos abertos (fim IS NULL) na OS
    const ativos = await this.prisma.apontamento.findMany({
      where: { companyId, fim: null, osSubtarefaId: { not: null } },
      include: {
        employee: {
          select: {
            id: true,
            matricula: true,
            cargo: true,
            person: { select: { id: true, razaoSocial: true } },
          },
        },
        osSubtarefa: {
          include: {
            osTarefa: {
              include: {
                serviceOrder: {
                  select: {
                    id: true,
                    numero: true,
                    equipamento: { select: { placa: true, chassi: true, serialNumber: true, tipo: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { inicio: 'desc' },
    });

    return ativos.map((a) => ({
      apontamentoId: a.id,
      employeeId: a.employeeId,
      employeeMatricula: a.employee.matricula,
      employeeNome: a.employee.person?.razaoSocial ?? a.employee.cargo,
      estado: a.pausado ? 'PAUSADO' : 'TRABALHANDO',
      inicio: a.inicio,
      osNumero: a.osSubtarefa?.osTarefa?.serviceOrder?.numero,
      osId: a.osSubtarefa?.osTarefa?.serviceOrder?.id,
      equipamento: a.osSubtarefa?.osTarefa?.serviceOrder?.equipamento,
      tarefaTitulo: a.osSubtarefa?.osTarefa?.titulo,
      subtarefaNome: a.osSubtarefa?.nome,
    }));
  }

  async getSinaleira(companyId: string) {
    // Todos os mecânicos ativos (LEFT JOIN com apontamentos abertos)
    const mecanicos = await this.prisma.employee.findMany({
      where: {
        companyId,
        status: 'ATIVO',
        apontamentoRole: { in: ['MECANICO', 'OPERADOR'] },
      },
      include: {
        person: { select: { razaoSocial: true } },
        apontamentos: {
          where: { fim: null, companyId },
          take: 1,
        },
      },
      orderBy: { matricula: 'asc' },
    });

    const result = mecanicos.map((m) => {
      const aberto = m.apontamentos[0];
      let estado: 'TRABALHANDO' | 'PAUSADO' | 'PARADO' = 'PARADO';
      if (aberto) {
        estado = aberto.pausado ? 'PAUSADO' : 'TRABALHANDO';
      }
      return {
        employeeId: m.id,
        matricula: m.matricula,
        nome: m.person?.razaoSocial ?? m.cargo,
        cargo: m.cargo,
        estado,
        apontamentoId: aberto?.id ?? null,
        inicio: aberto?.inicio ?? null,
      };
    });

    // Ordena: TRABALHANDO → PAUSADO → PARADO
    const order = { TRABALHANDO: 0, PAUSADO: 1, PARADO: 2 };
    result.sort((a, b) => order[a.estado] - order[b.estado] || a.matricula.localeCompare(b.matricula));

    const totais = {
      trabalhando: result.filter((r) => r.estado === 'TRABALHANDO').length,
      pausados: result.filter((r) => r.estado === 'PAUSADO').length,
      parados: result.filter((r) => r.estado === 'PARADO').length,
    };

    return { totais, mecanicos: result };
  }

  // ── Histórico de apontamentos de uma OS ───────────────────────────────────

  async getHistoricoOS(serviceOrderId: string) {
    const apontamentos = await this.prisma.apontamento.findMany({
      where: { serviceOrderId },
      include: {
        employee: { select: { matricula: true, person: { select: { razaoSocial: true } } } },
        osSubtarefa: { select: { nome: true, osTarefa: { select: { titulo: true } } } },
        segmentos: { orderBy: { inicio: 'asc' } },
      },
      orderBy: { inicio: 'asc' },
    });

    return apontamentos;
  }

  // ── Eficiência por OS ─────────────────────────────────────────────────────

  async getEficienciaOS(serviceOrderId: string) {
    const osTarefas = await this.prisma.osTarefa.findMany({
      where: { serviceOrderId },
      include: {
        subtarefas: {
          include: {
            apontamentos: { where: { fim: { not: null } } },
          },
        },
      },
    });

    return osTarefas.map((t) => {
      const subResult = t.subtarefas.map((s) => {
        const horasReais = Number(s.horasApontadas ?? 0);
        const horasPadrao = s.tempoPadraoH;
        const eficiencia = horasPadrao > 0 ? (horasPadrao / horasReais) * 100 : null;
        return {
          subtarefaId: s.id,
          nome: s.nome,
          horasPadrao,
          horasReais,
          eficiencia: eficiencia ? Math.round(eficiencia) : null,
          status: s.status,
        };
      });

      const totalPadrao = t.subtarefas.reduce((s, sub) => s + sub.tempoPadraoH, 0);
      const totalReal = subResult.reduce((s, sub) => s + sub.horasReais, 0);
      const eficienciaGeral = totalPadrao > 0 && totalReal > 0
        ? Math.round((totalPadrao / totalReal) * 100)
        : null;

      return {
        osTarefaId: t.id,
        titulo: t.titulo,
        totalHorasPadrao: totalPadrao,
        totalHorasReais: totalReal,
        eficienciaGeral,
        subtarefas: subResult,
      };
    });
  }

  // ── Relatório de Eficiência por Mecânico ─────────────────────────────────

  async getRelatorioMecanicos(
    companyId: string,
    params: {
      dataInicio?: string;
      dataFim?: string;
      employeeId?: string;
    },
  ) {
    const whereInicio: { gte?: Date; lte?: Date } = {};
    if (params.dataInicio) whereInicio.gte = new Date(params.dataInicio);
    if (params.dataFim) {
      const fim = new Date(params.dataFim);
      fim.setHours(23, 59, 59, 999);
      whereInicio.lte = fim;
    }

    const apontamentos = await this.prisma.apontamento.findMany({
      where: {
        companyId,
        fim: { not: null },
        osSubtarefaId: { not: null },
        status: 'CONCLUIDO',
        ...(Object.keys(whereInicio).length > 0 && { inicio: whereInicio }),
        ...(params.employeeId && { employeeId: params.employeeId }),
      },
      include: {
        employee: {
          select: {
            id: true,
            matricula: true,
            cargo: true,
            apontamentoRole: true,
            person: { select: { razaoSocial: true } },
          },
        },
        osSubtarefa: {
          select: {
            id: true,
            nome: true,
            tempoPadraoH: true,
            status: true,
            osTarefa: {
              select: {
                titulo: true,
                serviceOrder: { select: { id: true, numero: true } },
              },
            },
          },
        },
      },
      orderBy: { inicio: 'asc' },
    });

    // Agrupa por mecânico
    const map = new Map<
      string,
      {
        employeeId: string;
        nome: string;
        matricula: string;
        cargo: string;
        apontamentoRole: string;
        totalHorasReais: number;
        totalHorasPadrao: number;
        qtdApontamentos: number;
        qtdSubtarefasConcluidas: number;
        osIds: Set<string>;
        detalhe: {
          apontamentoId: string;
          osId: string | null;
          osNumero: string | null;
          tarefaTitulo: string | null;
          subtarefaNome: string | null;
          horasPadrao: number;
          horasReais: number;
          eficiencia: number | null;
          inicio: Date;
          fim: Date | null;
        }[];
      }
    >();

    for (const a of apontamentos) {
      const empId = a.employeeId;
      if (!map.has(empId)) {
        map.set(empId, {
          employeeId: empId,
          nome: a.employee.person?.razaoSocial ?? a.employee.cargo,
          matricula: a.employee.matricula,
          cargo: a.employee.cargo,
          apontamentoRole: a.employee.apontamentoRole,
          totalHorasReais: 0,
          totalHorasPadrao: 0,
          qtdApontamentos: 0,
          qtdSubtarefasConcluidas: 0,
          osIds: new Set<string>(),
          detalhe: [],
        });
      }

      const emp = map.get(empId)!;
      const horasReais = Number(a.totalHoras ?? 0);
      const horasPadrao = a.osSubtarefa?.tempoPadraoH ?? 0;
      const osId = a.osSubtarefa?.osTarefa?.serviceOrder?.id ?? null;
      const osNumero = a.osSubtarefa?.osTarefa?.serviceOrder?.numero ?? null;

      emp.totalHorasReais += horasReais;
      emp.totalHorasPadrao += horasPadrao;
      emp.qtdApontamentos += 1;
      if (a.osSubtarefa?.status === 'CONCLUIDA') emp.qtdSubtarefasConcluidas += 1;
      if (osId) emp.osIds.add(osId);

      const eficiencia =
        horasPadrao > 0 && horasReais > 0
          ? Math.round((horasPadrao / horasReais) * 100)
          : null;

      emp.detalhe.push({
        apontamentoId: a.id,
        osId,
        osNumero,
        tarefaTitulo: a.osSubtarefa?.osTarefa?.titulo ?? null,
        subtarefaNome: a.osSubtarefa?.nome ?? null,
        horasPadrao,
        horasReais,
        eficiencia,
        inicio: a.inicio,
        fim: a.fim,
      });
    }

    const mecanicos = Array.from(map.values()).map((emp) => {
      const eficiencia =
        emp.totalHorasPadrao > 0 && emp.totalHorasReais > 0
          ? Math.round((emp.totalHorasPadrao / emp.totalHorasReais) * 100)
          : null;
      return {
        employeeId: emp.employeeId,
        nome: emp.nome,
        matricula: emp.matricula,
        cargo: emp.cargo,
        apontamentoRole: emp.apontamentoRole,
        totalHorasReais: Math.round(emp.totalHorasReais * 100) / 100,
        totalHorasPadrao: Math.round(emp.totalHorasPadrao * 100) / 100,
        eficiencia,
        qtdApontamentos: emp.qtdApontamentos,
        qtdSubtarefasConcluidas: emp.qtdSubtarefasConcluidas,
        qtdOS: emp.osIds.size,
        detalhe: emp.detalhe,
      };
    });

    // Ordena por eficiência desc (nulos por último)
    mecanicos.sort((a, b) => (b.eficiencia ?? -1) - (a.eficiencia ?? -1));

    const totalHorasReais = mecanicos.reduce((s, m) => s + m.totalHorasReais, 0);
    const totalHorasPadrao = mecanicos.reduce((s, m) => s + m.totalHorasPadrao, 0);
    const eficienciaGeral =
      totalHorasPadrao > 0 && totalHorasReais > 0
        ? Math.round((totalHorasPadrao / totalHorasReais) * 100)
        : null;

    return {
      periodo: {
        dataInicio: params.dataInicio ?? null,
        dataFim: params.dataFim ?? null,
      },
      resumo: {
        totalMecanicos: mecanicos.length,
        totalHorasReais: Math.round(totalHorasReais * 100) / 100,
        totalHorasPadrao: Math.round(totalHorasPadrao * 100) / 100,
        eficienciaGeral,
      },
      mecanicos,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async fecharSegmentoAtivo(apontamentoId: string) {
    const segmentoAtivo = await this.prisma.apontamentoSegmento.findFirst({
      where: { apontamentoId, fim: null },
    });
    if (!segmentoAtivo) return;

    const agora = new Date();
    const horas = (agora.getTime() - segmentoAtivo.inicio.getTime()) / 3_600_000;

    await this.prisma.apontamentoSegmento.update({
      where: { id: segmentoAtivo.id },
      data: { fim: agora, horas },
    });
  }

  private async calcularHorasAcumuladas(osSubtarefaId: string): Promise<number> {
    const apts = await this.prisma.apontamento.findMany({
      where: { osSubtarefaId, fim: { not: null } },
      select: { totalHoras: true },
    });
    return apts.reduce((sum, a) => sum + Number(a.totalHoras ?? 0), 0);
  }

  private async getApontamentoAtual(osSubtarefaId: string, employeeId: string) {
    return this.prisma.apontamento.findFirst({
      where: { osSubtarefaId, employeeId, fim: null },
      include: { segmentos: { orderBy: { inicio: 'desc' }, take: 1 } },
    });
  }
}
