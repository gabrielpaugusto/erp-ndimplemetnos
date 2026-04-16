import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateJornadaDto } from './dto/create-jornada.dto';
import { CreateFeriadoDto } from './dto/create-feriado.dto';

@Injectable()
export class JornadaService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Jornadas ─────────────────────────────────────────────────────────────

  async findAllJornadas(companyId: string) {
    return this.prisma.jornadaTrabalho.findMany({
      where: { companyId },
      include: { _count: { select: { employees: true } } },
      orderBy: { nome: 'asc' },
    });
  }

  async createJornada(companyId: string, dto: CreateJornadaDto) {
    return this.prisma.jornadaTrabalho.create({
      data: { companyId, ...dto },
    });
  }

  async updateJornada(companyId: string, id: string, dto: Partial<CreateJornadaDto>) {
    await this.findOneJornada(companyId, id);
    return this.prisma.jornadaTrabalho.update({ where: { id }, data: dto });
  }

  async removeJornada(companyId: string, id: string) {
    await this.findOneJornada(companyId, id);
    return this.prisma.jornadaTrabalho.delete({ where: { id } });
  }

  private async findOneJornada(companyId: string, id: string) {
    const j = await this.prisma.jornadaTrabalho.findFirst({ where: { id, companyId } });
    if (!j) throw new NotFoundException('Jornada não encontrada');
    return j;
  }

  // ── Feriados ──────────────────────────────────────────────────────────────

  async findFeriados(companyId: string, ano?: string) {
    const year = ano ? parseInt(ano) : new Date().getFullYear();
    return this.prisma.feriadoCalendario.findMany({
      where: {
        companyId,
        data: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      },
      orderBy: { data: 'asc' },
    });
  }

  async createFeriado(companyId: string, dto: CreateFeriadoDto) {
    const data = new Date(dto.data);
    const exists = await this.prisma.feriadoCalendario.findUnique({
      where: { companyId_data: { companyId, data } },
    });
    if (exists) throw new ConflictException('Já existe um feriado nesta data');
    return this.prisma.feriadoCalendario.create({
      data: { companyId, data, descricao: dto.descricao, tipo: dto.tipo ?? 'FERIADO' },
    });
  }

  async removeFeriado(companyId: string, id: string) {
    const f = await this.prisma.feriadoCalendario.findFirst({ where: { id, companyId } });
    if (!f) throw new NotFoundException('Feriado não encontrado');
    return this.prisma.feriadoCalendario.delete({ where: { id } });
  }

  // ── Carga Horária ─────────────────────────────────────────────────────────

  async calcularCargaMensal(companyId: string, mes: string) {
    // mes = "YYYY-MM"
    const [year, month] = mes.split('-').map(Number);
    const inicio = new Date(year, month - 1, 1);
    const fim = new Date(year, month, 0); // último dia do mês

    // Feriados do período
    const feriados = await this.prisma.feriadoCalendario.findMany({
      where: { companyId, data: { gte: inicio, lte: fim }, tipo: 'FERIADO' },
    });
    const feriadosDates = new Set(feriados.map((f) => f.data.toISOString().slice(0, 10)));

    // Jornadas com funcionários
    const jornadas = await this.prisma.jornadaTrabalho.findMany({
      where: { companyId, ativo: true },
      include: {
        employees: {
          where: { status: 'ATIVO' },
          select: { id: true, matricula: true, cargo: true },
        },
      },
    });

    return jornadas.map((j) => {
      const horasPorDia = this.calcularHorasDia(j.horaInicio, j.horaFim, j.intervaloH);
      let diasUteis = 0;

      for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay(); // 0=dom, 6=sab
        const dateStr = d.toISOString().slice(0, 10);
        const isWorkDay =
          (dow >= 1 && dow <= 5 && j.segSex) ||
          (dow === 6 && j.sabado) ||
          (dow === 0 && j.domingo);
        if (isWorkDay && !feriadosDates.has(dateStr)) diasUteis++;
      }

      const cargaHoras = diasUteis * horasPorDia;

      return {
        jornada: { id: j.id, nome: j.nome },
        diasUteis,
        horasPorDia,
        cargaHoras,
        funcionarios: j.employees.length,
      };
    });
  }

  private calcularHorasDia(inicio: string, fim: string, intervalo: number): number {
    const [ih, im] = inicio.split(':').map(Number);
    const [fh, fm] = fim.split(':').map(Number);
    const totalMin = (fh * 60 + fm) - (ih * 60 + im);
    return (totalMin / 60) - intervalo;
  }
}
