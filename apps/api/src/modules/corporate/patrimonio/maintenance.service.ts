import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { StorageService } from '@/modules/core/storage/storage.service';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ----------------------------------------------------------------
  // CRUD
  // ----------------------------------------------------------------
  async findAll(companyId: string, query: {
    assetId?: string; status?: string; type?: string; local?: string;
    page?: string; limit?: string;
  }) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;
    const where: any = { companyId };

    if (query.assetId) where.assetId = query.assetId;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.local) where.local = query.local;

    const [data, total] = await Promise.all([
      this.prisma.fixedAssetMaintenance.findMany({
        where, skip, take: limit,
        orderBy: { dataAbertura: 'desc' },
        include: {
          asset: { select: { plaqueta: true, descricao: true, localizacao: true } },
          _count: { select: { anexos: true } },
        },
      }),
      this.prisma.fixedAssetMaintenance.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // Manutenções externas em aberto (aguardando retorno)
  async findExternasEmAberto(companyId: string) {
    const agora = new Date();
    const manutencoes = await this.prisma.fixedAssetMaintenance.findMany({
      where: {
        companyId,
        local: 'EXTERNA',
        status: { in: ['ABERTA', 'EM_EXECUCAO', 'AGUARDANDO_RETORNO'] as any[] },
      },
      include: {
        asset: { select: { plaqueta: true, descricao: true, type: true, localizacao: true } },
      },
      orderBy: { dataRetornoPrevista: 'asc' },
    });

    return manutencoes.map(m => ({
      ...m,
      atrasada: m.dataRetornoPrevista ? m.dataRetornoPrevista < agora : false,
      diasEmAberto: Math.floor((agora.getTime() - new Date(m.dataEnvio || m.dataAbertura).getTime()) / 86400000),
      diasAtraso: m.dataRetornoPrevista && m.dataRetornoPrevista < agora
        ? Math.floor((agora.getTime() - new Date(m.dataRetornoPrevista).getTime()) / 86400000)
        : 0,
    }));
  }

  async findOne(id: string) {
    const m = await this.prisma.fixedAssetMaintenance.findUnique({
      where: { id },
      include: {
        asset: { select: { plaqueta: true, descricao: true, type: true, localizacao: true, costCenterCode: true } },
        anexos: { orderBy: { uploadedAt: 'desc' } },
      },
    });
    if (!m) throw new NotFoundException('Manutenção não encontrada');
    return m;
  }

  async create(companyId: string, data: {
    assetId: string; type: string; local: string;
    fornecedorId?: string; fornecedorNome?: string;
    dataEnvio?: string; dataRetornoPrevista?: string;
    notaFiscalRemessa?: string; descricaoProblema?: string; observacoes?: string;
  }) {
    const asset = await this.prisma.fixedAsset.findUnique({ where: { id: data.assetId } });
    if (!asset) throw new NotFoundException('Ativo não encontrado');

    const numero = await this.generateNumero(companyId);

    // Se externa, muda status do ativo para EM_MANUTENCAO
    if (data.local === 'EXTERNA') {
      await this.prisma.fixedAsset.update({
        where: { id: data.assetId },
        data: { status: 'EM_MANUTENCAO' as any },
      });
    }

    return this.prisma.fixedAssetMaintenance.create({
      data: {
        companyId,
        assetId: data.assetId,
        numero,
        type: data.type as any,
        local: data.local as any,
        status: data.local === 'EXTERNA' ? ('AGUARDANDO_RETORNO' as any) : ('ABERTA' as any),
        fornecedorId: data.fornecedorId || null,
        fornecedorNome: data.fornecedorNome,
        dataEnvio: data.dataEnvio ? new Date(data.dataEnvio) : (data.local === 'EXTERNA' ? new Date() : null),
        dataRetornoPrevista: data.dataRetornoPrevista ? new Date(data.dataRetornoPrevista) : null,
        notaFiscalRemessa: data.notaFiscalRemessa,
        descricaoProblema: data.descricaoProblema,
        observacoes: data.observacoes,
      },
      include: {
        asset: { select: { plaqueta: true, descricao: true } },
      },
    });
  }

  async update(id: string, data: any) {
    const m = await this.prisma.fixedAssetMaintenance.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Manutenção não encontrada');

    const updateData: any = { ...data };
    if (data.dataEnvio) updateData.dataEnvio = new Date(data.dataEnvio);
    if (data.dataRetornoPrevista) updateData.dataRetornoPrevista = new Date(data.dataRetornoPrevista);
    if (data.dataRetornoReal) updateData.dataRetornoReal = new Date(data.dataRetornoReal);
    if (data.dataConclusao) updateData.dataConclusao = new Date(data.dataConclusao);

    return this.prisma.fixedAssetMaintenance.update({ where: { id }, data: updateData });
  }

  async concluir(id: string, data: {
    descricaoServico: string; valorServico?: number; valorPecas?: number;
    notaFiscalServico?: string; notaFiscalRetorno?: string;
    dataRetornoReal?: string;
  }) {
    const m = await this.prisma.fixedAssetMaintenance.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Manutenção não encontrada');
    if (m.status === 'CONCLUIDA') throw new BadRequestException('Manutenção já está concluída');

    await this.prisma.$transaction([
      this.prisma.fixedAssetMaintenance.update({
        where: { id },
        data: {
          status: 'CONCLUIDA' as any,
          descricaoServico: data.descricaoServico,
          valorServico: data.valorServico,
          valorPecas: data.valorPecas,
          notaFiscalServico: data.notaFiscalServico,
          notaFiscalRetorno: data.notaFiscalRetorno,
          dataRetornoReal: data.dataRetornoReal ? new Date(data.dataRetornoReal) : new Date(),
          dataConclusao: new Date(),
        },
      }),
      // Se era externa, volta o ativo para ATIVO
      ...(m.local === 'EXTERNA'
        ? [this.prisma.fixedAsset.update({
            where: { id: m.assetId },
            data: { status: 'ATIVO' as any },
          })]
        : []),
    ]);

    return this.findOne(id);
  }

  // ----------------------------------------------------------------
  // ANEXOS
  // ----------------------------------------------------------------
  async uploadAnexo(maintenanceId: string, file: Express.Multer.File, companyId: string) {
    const m = await this.prisma.fixedAssetMaintenance.findUnique({ where: { id: maintenanceId } });
    if (!m) throw new NotFoundException('Manutenção não encontrada');

    const ext = path.extname(file.originalname);
    const objectKey = `maintenance/${companyId}/${maintenanceId}/${uuidv4()}${ext}`;

    const { bucket, fileUrl } = await this.storage.upload(objectKey, file.buffer, file.mimetype);

    return this.prisma.maintenanceAttachment.create({
      data: {
        maintenanceId,
        fileName: `${uuidv4()}${ext}`,
        originalName: file.originalname,
        fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        bucket,
        objectKey,
      },
    });
  }

  async deleteAnexo(attachmentId: string) {
    const att = await this.prisma.maintenanceAttachment.findUnique({ where: { id: attachmentId } });
    if (!att) throw new NotFoundException('Anexo não encontrado');

    await this.storage.delete(att.objectKey);
    await this.prisma.maintenanceAttachment.delete({ where: { id: attachmentId } });
    return { message: 'Anexo removido' };
  }

  async getPresignedUrl(attachmentId: string): Promise<{ url: string }> {
    const att = await this.prisma.maintenanceAttachment.findUnique({ where: { id: attachmentId } });
    if (!att) throw new NotFoundException('Anexo não encontrado');
    const url = await this.storage.getPresignedUrl(att.objectKey, 3600);
    return { url };
  }

  // ----------------------------------------------------------------
  // STATS
  // ----------------------------------------------------------------
  async getStats(companyId: string) {
    const agora = new Date();
    const [porStatus, externas, atrasadas, custoMes] = await Promise.all([
      this.prisma.fixedAssetMaintenance.groupBy({
        by: ['status'], where: { companyId }, _count: { id: true },
      }),
      this.prisma.fixedAssetMaintenance.count({
        where: { companyId, local: 'EXTERNA', status: { in: ['ABERTA', 'EM_EXECUCAO', 'AGUARDANDO_RETORNO'] as any[] } },
      }),
      this.prisma.fixedAssetMaintenance.count({
        where: { companyId, status: { in: ['ABERTA', 'EM_EXECUCAO', 'AGUARDANDO_RETORNO'] as any[] }, dataRetornoPrevista: { lt: agora } },
      }),
      this.prisma.fixedAssetMaintenance.aggregate({
        where: {
          companyId, status: 'CONCLUIDA' as any,
          dataConclusao: { gte: new Date(agora.getFullYear(), agora.getMonth(), 1) },
        },
        _sum: { valorServico: true, valorPecas: true },
      }),
    ]);

    return {
      porStatus,
      externasEmAberto: externas,
      atrasadas,
      custoMesAtual: Number(custoMes._sum.valorServico || 0) + Number(custoMes._sum.valorPecas || 0),
    };
  }

  private async generateNumero(companyId: string): Promise<string> {
    const ano = new Date().getFullYear();
    const prefix = `MAT-${ano}-`;
    const last = await this.prisma.fixedAssetMaintenance.findFirst({
      where: { companyId, numero: { startsWith: prefix } },
      orderBy: { numero: 'desc' },
    });
    const seq = last ? parseInt(last.numero.replace(prefix, '')) + 1 : 1;
    return `${prefix}${seq.toString().padStart(4, '0')}`;
  }
}
