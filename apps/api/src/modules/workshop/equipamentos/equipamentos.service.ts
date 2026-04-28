import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class EquipamentosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, query: {
    tipo?: string;
    search?: string;
    proprietarioId?: string;
    ativo?: string;
    page?: string;
    limit?: string;
  }) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '30', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.tipo) where.tipo = query.tipo;
    if (query.proprietarioId) where.proprietarioId = query.proprietarioId;
    if (query.ativo !== undefined) where.ativo = query.ativo === 'true';

    if (query.search) {
      where.OR = [
        { chassi: { contains: query.search, mode: 'insensitive' } },
        { placa: { contains: query.search, mode: 'insensitive' } },
        { serialNumber: { contains: query.search, mode: 'insensitive' } },
        { marca: { contains: query.search, mode: 'insensitive' } },
        { modelo: { contains: query.search, mode: 'insensitive' } },
        { proprietario: { razaoSocial: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.equipamento.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ tipo: 'asc' }, { createdAt: 'desc' }],
        include: {
          proprietario: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
          tipoCarroceria: { select: { id: true, nome: true, codigoLegal: true } },
          modeloCarroceria: { select: { id: true, nome: true, fabricante: true } },
          carroceriaVinculos: {
            where: { ativo: true },
            include: {
              veiculo: { select: { id: true, placa: true, marca: true, modelo: true, tipo: true } },
            },
          },
          veiculoVinculos: {
            where: { ativo: true },
            include: {
              carroceria: { select: { id: true, serialNumber: true, tipoCarroceria: { select: { nome: true } } } },
            },
          },
        },
      }),
      this.prisma.equipamento.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const eq = await this.prisma.equipamento.findUnique({
      where: { id },
      include: {
        proprietario: { select: { id: true, razaoSocial: true, cpfCnpj: true, nomeFantasia: true } },
        tipoCarroceria: true,
        modeloCarroceria: true,
        carroceriaVinculos: {
          include: {
            veiculo: { select: { id: true, tipo: true, placa: true, chassi: true, marca: true, modelo: true } },
          },
          orderBy: { dataVinculo: 'desc' },
        },
        veiculoVinculos: {
          include: {
            carroceria: {
              select: { id: true, serialNumber: true, tipoCarroceria: { select: { nome: true } }, modeloCarroceria: { select: { nome: true } } },
            },
          },
          orderBy: { dataVinculo: 'desc' },
        },
        ordensServico: {
          select: { id: true, numero: true, status: true, type: true, dataEntrada: true },
          orderBy: { dataEntrada: 'desc' },
          take: 10,
        },
      },
    });

    if (!eq) throw new NotFoundException(`Equipamento ${id} não encontrado`);
    return eq;
  }

  async create(companyId: string, data: any) {
    this.validateTipoFields(data);

    // Gera serial number automático para carroceria se não informado
    if (data.tipo === 'CARROCERIA' && !data.serialNumber) {
      data.serialNumber = await this.generateSerialNumber(companyId);
    }

    return this.prisma.equipamento.create({
      data: { companyId, ...data },
      include: {
        proprietario: { select: { id: true, razaoSocial: true } },
        tipoCarroceria: { select: { id: true, nome: true } },
        modeloCarroceria: { select: { id: true, nome: true } },
      },
    });
  }

  async update(id: string, data: any) {
    const existing = await this.prisma.equipamento.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Equipamento ${id} não encontrado`);

    return this.prisma.equipamento.update({
      where: { id },
      data,
      include: {
        proprietario: { select: { id: true, razaoSocial: true } },
        tipoCarroceria: { select: { id: true, nome: true } },
        modeloCarroceria: { select: { id: true, nome: true } },
      },
    });
  }

  // ── Vínculo Carroceria ↔ Veículo ──────────────────────────────────────────

  async vincular(carroceriaId: string, veiculoId: string, observations?: string) {
    const [carroceria, veiculo] = await Promise.all([
      this.prisma.equipamento.findUnique({ where: { id: carroceriaId } }),
      this.prisma.equipamento.findUnique({ where: { id: veiculoId } }),
    ]);

    if (!carroceria || carroceria.tipo !== 'CARROCERIA')
      throw new BadRequestException('carroceriaId deve referenciar um equipamento do tipo CARROCERIA');

    if (!veiculo || !['REBOQUE', 'SEMIRREBOQUE'].includes(veiculo.tipo))
      throw new BadRequestException('veiculoId deve referenciar REBOQUE ou SEMIRREBOQUE');

    // Desativa vínculos ativos anteriores
    await this.prisma.equipamentoVinculo.updateMany({
      where: { carroceriaId, ativo: true },
      data: { ativo: false, dataDesvinculo: new Date() },
    });

    const vinculo = await this.prisma.equipamentoVinculo.create({
      data: { carroceriaId, veiculoId: veiculoId, observations },
      include: {
        carroceria: { select: { id: true, serialNumber: true } },
        veiculo: { select: { id: true, placa: true, tipo: true } },
      },
    });

    // Atualiza status da carroceria para INSTALADA
    await this.prisma.equipamento.update({
      where: { id: carroceriaId },
      data: { carroceriaStatus: 'INSTALADA' },
    });

    return vinculo;
  }

  async desvincular(vinculoId: string) {
    const vinculo = await this.prisma.equipamentoVinculo.findUnique({ where: { id: vinculoId } });
    if (!vinculo) throw new NotFoundException(`Vínculo ${vinculoId} não encontrado`);

    await this.prisma.equipamentoVinculo.update({
      where: { id: vinculoId },
      data: { ativo: false, dataDesvinculo: new Date() },
    });

    // Reverte status para AGUARD_VEICULO
    await this.prisma.equipamento.update({
      where: { id: vinculo.carroceriaId },
      data: { carroceriaStatus: 'AGUARD_VEICULO' },
    });

    return { success: true };
  }

  // ── Tipos e Modelos de Carroceria ─────────────────────────────────────────

  async findTiposCarroceria() {
    return this.prisma.tipoCarroceria.findMany({
      where: { ativo: true },
      include: { modelos: { where: { ativo: true }, orderBy: { nome: 'asc' } } },
      orderBy: { ordem: 'asc' },
    });
  }

  async findModelosCarroceria(tipoCarroceriaId?: string) {
    return this.prisma.modeloCarroceria.findMany({
      where: { ativo: true, ...(tipoCarroceriaId ? { tipoCarroceriaId } : {}) },
      include: { tipoCarroceria: { select: { id: true, nome: true } } },
      orderBy: { nome: 'asc' },
    });
  }

  async createTipoCarroceria(data: { codigoLegal: string; nome: string; descricao?: string; ordem?: number }) {
    return this.prisma.tipoCarroceria.create({ data });
  }

  async updateTipoCarroceria(id: string, data: any) {
    return this.prisma.tipoCarroceria.update({ where: { id }, data });
  }

  async createModeloCarroceria(data: { tipoCarroceriaId: string; nome: string; descricao?: string; fabricante?: string }) {
    return this.prisma.modeloCarroceria.create({ data });
  }

  async updateModeloCarroceria(id: string, data: any) {
    return this.prisma.modeloCarroceria.update({ where: { id }, data });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private validateTipoFields(data: any) {
    if (data.tipo === 'CARROCERIA') {
      if (data.placa) throw new BadRequestException('CARROCERIA não tem placa');
      if (data.chassi) throw new BadRequestException('CARROCERIA não tem chassi — use serialNumber');
    }
    if (data.tipo === 'REBOQUE') {
      if (data.chassi) throw new BadRequestException('REBOQUE não tem chassi');
    }
    if (data.chassi && !/^[A-HJ-NPR-Z0-9]{17}$/.test(data.chassi)) {
      throw new BadRequestException('Chassi inválido — formato VIN: 17 caracteres alfanuméricos (sem I, O, Q)');
    }
  }

  private async generateSerialNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ND-${year}-`;
    const last = await this.prisma.equipamento.findFirst({
      where: { companyId, tipo: 'CARROCERIA', serialNumber: { startsWith: prefix } },
      orderBy: { serialNumber: 'desc' },
    });

    const seq = last?.serialNumber
      ? parseInt(last.serialNumber.replace(prefix, ''), 10) + 1
      : 1;

    return `${prefix}${seq.toString().padStart(3, '0')}`;
  }
}
