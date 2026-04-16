import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { IniciarApontamentoDto, TipoVinculo } from './dto/iniciar-apontamento.dto';
import { PararApontamentoDto } from './dto/parar-apontamento.dto';

@Injectable()
export class ApontamentosService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Buscar ordens disponíveis para apontar ────────────────────────────────

  async ordensDisponiveis(companyId: string) {
    const [producao, oficina, calderaria] = await Promise.all([
      this.prisma.productionOrder.findMany({
        where: { companyId, status: { in: ['LIBERADA', 'EM_PRODUCAO'] } },
        select: {
          id: true, numero: true, status: true,
          product: { select: { description: true } },
        },
        orderBy: { numero: 'asc' },
      }),
      this.prisma.serviceOrder.findMany({
        where: { companyId, status: { in: ['ABERTA', 'EM_EXECUCAO'] } },
        select: {
          id: true, numero: true, status: true,
          veiculoDescricao: true, veiculoPlaca: true,
          person: { select: { razaoSocial: true } },
        },
        orderBy: { numero: 'asc' },
      }),
      this.prisma.calderariaOrder.findMany({
        where: { companyId, status: { in: ['ABERTA', 'EM_EXECUCAO'] } },
        select: {
          id: true, numero: true, status: true,
          description: true, serviceType: true,
        },
        orderBy: { numero: 'asc' },
      }),
    ]);
    return { producao, oficina, calderaria };
  }

  async etapasDaOrdem(companyId: string, tipo: string, orderId: string) {
    if (tipo === 'PRODUCAO') {
      const op = await this.prisma.productionOrder.findFirst({
        where: { id: orderId, companyId },
        include: { routing: { include: { steps: { include: { workCenter: true }, orderBy: { stepNumber: 'asc' } } } } },
      });
      if (!op) throw new NotFoundException('Ordem de produção não encontrada');
      return op.routing?.steps ?? [];
    }

    if (tipo === 'OFICINA') {
      const os = await this.prisma.serviceOrder.findFirst({ where: { id: orderId, companyId } });
      if (!os) throw new NotFoundException('Ordem de serviço não encontrada');
      return this.prisma.etapaOS.findMany({
        where: { serviceOrderId: orderId, status: { not: 'CANCELADA' } },
        orderBy: { sequencia: 'asc' },
      });
    }

    if (tipo === 'CALDERARIA') {
      const oc = await this.prisma.calderariaOrder.findFirst({ where: { id: orderId, companyId } });
      if (!oc) throw new NotFoundException('Ordem de calderaria não encontrada');
      return this.prisma.etapaCalderaria.findMany({
        where: { calderariaOrderId: orderId, status: { not: 'CANCELADA' } },
        orderBy: { sequencia: 'asc' },
      });
    }

    throw new BadRequestException('Tipo inválido. Use PRODUCAO, OFICINA ou CALDERARIA');
  }

  // ── Resolver employeeId a partir do userId ────────────────────────────────

  private async resolveEmployeeId(companyId: string, userId: string): Promise<string> {
    const emp = await this.prisma.employee.findFirst({ where: { companyId, userId } });
    if (!emp) throw new BadRequestException('Usuário não possui vínculo de funcionário nesta empresa');
    return emp.id;
  }

  // ── Apontamento ativo do operador ─────────────────────────────────────────

  async meuAtivo(companyId: string, userId: string) {
    const employeeId = await this.resolveEmployeeId(companyId, userId);
    return this.prisma.apontamento.findFirst({
      where: { companyId, employeeId, status: { in: ['EM_ANDAMENTO', 'PAUSADO'] } },
      include: {
        productionOrder: { select: { numero: true, product: { select: { description: true } } } },
        routingStep: { select: { description: true, stepNumber: true } },
        serviceOrder: { select: { numero: true, veiculoDescricao: true, veiculoPlaca: true } },
        etapaOs: { select: { descricao: true, sequencia: true } },
        calderariaOrder: { select: { numero: true, description: true } },
        etapaCalderaria: { select: { descricao: true, sequencia: true } },
      },
    });
  }

  // ── Sinaleira ao vivo ─────────────────────────────────────────────────────

  async ativos(companyId: string) {
    const apontamentosAtivos = await this.prisma.apontamento.findMany({
      where: { companyId, status: { in: ['EM_ANDAMENTO', 'PAUSADO'] } },
      include: {
        employee: { include: { person: { select: { razaoSocial: true } } } },
        productionOrder: { select: { numero: true } },
        routingStep: { select: { description: true } },
        serviceOrder: { select: { numero: true, veiculoDescricao: true } },
        etapaOs: { select: { descricao: true } },
        calderariaOrder: { select: { numero: true, description: true } },
        etapaCalderaria: { select: { descricao: true } },
      },
      orderBy: { inicio: 'asc' },
    });

    // Funcionários ativos sem apontamento em andamento
    const employeesComApontamento = new Set(apontamentosAtivos.map((a) => a.employeeId));
    const semApontamento = await this.prisma.employee.findMany({
      where: {
        companyId,
        status: 'ATIVO',
        id: { notIn: [...employeesComApontamento] },
      },
      include: { person: { select: { razaoSocial: true } } },
    });

    return { ativos: apontamentosAtivos, semApontamento };
  }

  // ── Histórico ─────────────────────────────────────────────────────────────

  async historico(companyId: string, mes?: string) {
    const where: any = { companyId, status: 'CONCLUIDO' };
    if (mes) {
      const [year, month] = mes.split('-').map(Number);
      where.inicio = {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0, 23, 59, 59),
      };
    }
    return this.prisma.apontamento.findMany({
      where,
      include: {
        employee: { include: { person: { select: { razaoSocial: true } } } },
        productionOrder: { select: { numero: true } },
        serviceOrder: { select: { numero: true } },
        calderariaOrder: { select: { numero: true } },
      },
      orderBy: { inicio: 'desc' },
    });
  }

  // ── Relatório Produtividade ───────────────────────────────────────────────

  async produtividade(companyId: string, mes?: string) {
    const mesRef = mes ?? new Date().toISOString().slice(0, 7);
    const [year, month] = mesRef.split('-').map(Number);
    const inicio = new Date(year, month - 1, 1);
    const fim = new Date(year, month, 0, 23, 59, 59);

    const [employees, feriados] = await Promise.all([
      this.prisma.employee.findMany({
        where: { companyId, status: 'ATIVO' },
        include: {
          person: { select: { razaoSocial: true } },
          jornada: true,
          apontamentos: {
            where: { inicio: { gte: inicio, lte: fim }, status: 'CONCLUIDO' },
            select: { totalHoras: true },
          },
        },
      }),
      this.prisma.feriadoCalendario.findMany({
        where: { companyId, data: { gte: inicio, lte: fim }, tipo: 'FERIADO' },
      }),
    ]);

    const feriadosDates = new Set(feriados.map((f) => f.data.toISOString().slice(0, 10)));

    return employees.map((emp) => {
      let cargaEsperada = 0;

      if (emp.jornada) {
        const j = emp.jornada;
        const horasPorDia = this.calcularHorasDia(j.horaInicio, j.horaFim, j.intervaloH);
        let diasUteis = 0;
        for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
          const dow = d.getDay();
          const dateStr = d.toISOString().slice(0, 10);
          const isWorkDay =
            (dow >= 1 && dow <= 5 && j.segSex) ||
            (dow === 6 && j.sabado) ||
            (dow === 0 && j.domingo);
          if (isWorkDay && !feriadosDates.has(dateStr)) diasUteis++;
        }
        cargaEsperada = diasUteis * horasPorDia;
      } else {
        // Fallback: usa jornadaSemanal / 5 dias × dias úteis
        const horasPorDia = emp.jornadaSemanal / 5;
        let diasUteis = 0;
        for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
          const dow = d.getDay();
          const dateStr = d.toISOString().slice(0, 10);
          if (dow >= 1 && dow <= 5 && !feriadosDates.has(dateStr)) diasUteis++;
        }
        cargaEsperada = diasUteis * horasPorDia;
      }

      const horasApontadas = emp.apontamentos.reduce(
        (sum, a) => sum + (a.totalHoras ? Number(a.totalHoras) : 0),
        0,
      );

      const percentual = cargaEsperada > 0 ? (horasApontadas / cargaEsperada) * 100 : 0;

      return {
        employee: { id: emp.id, nome: emp.person.razaoSocial, matricula: emp.matricula, cargo: emp.cargo },
        cargaEsperada: Math.round(cargaEsperada * 100) / 100,
        horasApontadas: Math.round(horasApontadas * 100) / 100,
        percentual: Math.round(percentual * 10) / 10,
      };
    });
  }

  // ── Controle de Apontamento ───────────────────────────────────────────────

  async iniciar(companyId: string, userId: string, dto: IniciarApontamentoDto) {
    const employeeId = await this.resolveEmployeeId(companyId, userId);
    const ativo = await this.prisma.apontamento.findFirst({
      where: { companyId, employeeId, status: { in: ['EM_ANDAMENTO', 'PAUSADO'] } },
    });
    if (ativo) throw new ConflictException('Já existe um apontamento ativo. Pause ou pare antes de iniciar novo.');

    const data: any = {
      companyId,
      employeeId,
      inicio: new Date(),
      status: 'EM_ANDAMENTO',
    };

    if (dto.tipo === TipoVinculo.PRODUCAO) {
      if (!dto.productionOrderId) throw new BadRequestException('productionOrderId é obrigatório');
      data.productionOrderId = dto.productionOrderId;
      if (dto.routingStepId) data.routingStepId = dto.routingStepId;
    } else if (dto.tipo === TipoVinculo.OFICINA) {
      if (!dto.serviceOrderId) throw new BadRequestException('serviceOrderId é obrigatório');
      data.serviceOrderId = dto.serviceOrderId;
      if (dto.etapaOsId) {
        data.etapaOsId = dto.etapaOsId;
        await this.prisma.etapaOS.update({ where: { id: dto.etapaOsId }, data: { status: 'EM_EXECUCAO' } });
      }
    } else if (dto.tipo === TipoVinculo.CALDERARIA) {
      if (!dto.calderariaOrderId) throw new BadRequestException('calderariaOrderId é obrigatório');
      data.calderariaOrderId = dto.calderariaOrderId;
      if (dto.etapaCalderariaId) {
        data.etapaCalderariaId = dto.etapaCalderariaId;
        await this.prisma.etapaCalderaria.update({ where: { id: dto.etapaCalderariaId }, data: { status: 'EM_EXECUCAO' } });
      }
    }

    return this.prisma.apontamento.create({ data });
  }

  async pausar(companyId: string, userId: string) {
    const employeeId = await this.resolveEmployeeId(companyId, userId);
    const apontamento = await this.prisma.apontamento.findFirst({
      where: { companyId, employeeId, status: 'EM_ANDAMENTO' },
    });
    if (!apontamento) throw new NotFoundException('Nenhum apontamento em andamento encontrado');

    return this.prisma.apontamento.update({
      where: { id: apontamento.id },
      data: { pausado: true, status: 'PAUSADO' },
    });
  }

  async retomar(companyId: string, userId: string) {
    const employeeId = await this.resolveEmployeeId(companyId, userId);
    const apontamento = await this.prisma.apontamento.findFirst({
      where: { companyId, employeeId, status: 'PAUSADO' },
    });
    if (!apontamento) throw new NotFoundException('Nenhum apontamento pausado encontrado');

    return this.prisma.apontamento.update({
      where: { id: apontamento.id },
      data: { pausado: false, status: 'EM_ANDAMENTO' },
    });
  }

  async parar(companyId: string, userId: string, dto: PararApontamentoDto) {
    const employeeId = await this.resolveEmployeeId(companyId, userId);
    const apontamento = await this.prisma.apontamento.findFirst({
      where: { companyId, employeeId, status: { in: ['EM_ANDAMENTO', 'PAUSADO'] } },
    });
    if (!apontamento) throw new NotFoundException('Nenhum apontamento ativo encontrado');

    const fim = new Date();
    const totalMs = fim.getTime() - apontamento.inicio.getTime();
    const totalHoras = Math.round((totalMs / 3600000) * 10000) / 10000;

    const updated = await this.prisma.apontamento.update({
      where: { id: apontamento.id },
      data: {
        fim,
        totalHoras,
        status: 'CONCLUIDO',
        pausado: false,
        quantidadeProduzida: dto.quantidadeProduzida,
        quantidadeRejeitada: dto.quantidadeRejeitada,
        motivoParada: dto.motivoParada,
        observations: dto.observations,
      },
    });

    // Marcar etapa como concluída
    if (apontamento.etapaOsId) {
      await this.prisma.etapaOS.update({ where: { id: apontamento.etapaOsId }, data: { status: 'CONCLUIDA' } });
    }
    if (apontamento.etapaCalderariaId) {
      await this.prisma.etapaCalderaria.update({ where: { id: apontamento.etapaCalderariaId }, data: { status: 'CONCLUIDA' } });
    }

    return updated;
  }

  // ── Gerenciamento de Etapas ───────────────────────────────────────────────

  async criarEtapaOS(companyId: string, serviceOrderId: string, dto: { descricao: string; sequencia: number; tempoEstimadoH?: number }) {
    const os = await this.prisma.serviceOrder.findFirst({ where: { id: serviceOrderId, companyId } });
    if (!os) throw new NotFoundException('Ordem de serviço não encontrada');
    return this.prisma.etapaOS.create({ data: { serviceOrderId, ...dto } });
  }

  async criarEtapaCalderaria(companyId: string, calderariaOrderId: string, dto: { descricao: string; sequencia: number; tempoEstimadoH?: number }) {
    const oc = await this.prisma.calderariaOrder.findFirst({ where: { id: calderariaOrderId, companyId } });
    if (!oc) throw new NotFoundException('Ordem de calderaria não encontrada');
    return this.prisma.etapaCalderaria.create({ data: { calderariaOrderId, ...dto } });
  }

  private calcularHorasDia(inicio: string, fim: string, intervalo: number): number {
    const [ih, im] = inicio.split(':').map(Number);
    const [fh, fm] = fim.split(':').map(Number);
    const totalMin = (fh * 60 + fm) - (ih * 60 + im);
    return (totalMin / 60) - intervalo;
  }
}
