import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class NbsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string) {
    return this.prisma.nbsCode.findMany({
      where: search
        ? {
            OR: [
              { codigo: { contains: search, mode: 'insensitive' } },
              { descricao: { contains: search, mode: 'insensitive' } },
            ],
            ativo: true,
          }
        : { ativo: true },
      orderBy: { codigo: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.nbsCode.findUnique({ where: { id } });
  }

  async create(data: {
    codigo: string;
    descricao: string;
    unidade?: string;
    aliquotaIss?: number;
  }) {
    return this.prisma.nbsCode.create({ data });
  }

  async update(
    id: string,
    data: Partial<{
      codigo: string;
      descricao: string;
      unidade: string;
      aliquotaIss: number;
      ativo: boolean;
    }>,
  ) {
    return this.prisma.nbsCode.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.nbsCode.update({
      where: { id },
      data: { ativo: false },
    });
  }

  async seed() {
    const nbsCodes = [
      // Manutenção e reparação de veículos
      {
        codigo: '1.0900',
        descricao:
          'Serviços de manutenção e reparação de veículos automotores',
        unidade: 'UN',
      },
      {
        codigo: '1.0901',
        descricao:
          'Serviços de manutenção e reparação de automóveis, caminhonetes e utilitários',
        unidade: 'UN',
      },
      {
        codigo: '1.0902',
        descricao:
          'Serviços de manutenção e reparação de caminhões, ônibus e outros veículos pesados',
        unidade: 'UN',
      },
      {
        codigo: '1.0903',
        descricao:
          'Serviços de manutenção e reparação de motocicletas e motonetas',
        unidade: 'UN',
      },
      // Manutenção de máquinas e equipamentos
      {
        codigo: '1.1200',
        descricao:
          'Serviços de manutenção e reparação de máquinas e equipamentos agrícolas e florestais',
        unidade: 'UN',
      },
      {
        codigo: '1.1201',
        descricao: 'Serviços de manutenção e reparação de máquinas-ferramenta',
        unidade: 'UN',
      },
      {
        codigo: '1.1202',
        descricao:
          'Serviços de manutenção e reparação de equipamentos e instrumentos óticos e de precisão',
        unidade: 'UN',
      },
      {
        codigo: '1.1203',
        descricao:
          'Serviços de manutenção e reparação de equipamentos eletrônicos e de comunicações',
        unidade: 'UN',
      },
      {
        codigo: '1.1204',
        descricao:
          'Serviços de manutenção e reparação de máquinas e equipamentos industriais',
        unidade: 'UN',
      },
      {
        codigo: '1.1205',
        descricao:
          'Serviços de manutenção e reparação de equipamentos de informática e periféricos',
        unidade: 'UN',
      },
      // Representação comercial
      {
        codigo: '1.0905',
        descricao:
          'Serviços de representação comercial e agentes do comércio, exceto comércio de veículos automotores e motocicletas',
        unidade: 'UN',
      },
      {
        codigo: '1.0906',
        descricao:
          'Serviços de agentes de representação de veículos automotores, motocicletas e peças',
        unidade: 'UN',
      },
      // Consultoria
      {
        codigo: '1.0601',
        descricao:
          'Serviços de consultoria em gestão empresarial, exceto consultoria técnica específica',
        unidade: 'HR',
      },
      {
        codigo: '1.0602',
        descricao: 'Serviços de consultoria em tecnologia da informação',
        unidade: 'HR',
      },
      {
        codigo: '1.0603',
        descricao: 'Serviços de consultoria técnica em engenharia',
        unidade: 'HR',
      },
      {
        codigo: '1.0604',
        descricao: 'Serviços de consultoria jurídica',
        unidade: 'HR',
      },
      {
        codigo: '1.0605',
        descricao:
          'Serviços de consultoria contábil, financeira e tributária',
        unidade: 'HR',
      },
      // Transporte
      {
        codigo: '2.0101',
        descricao:
          'Serviços de transporte rodoviário de cargas, exceto produtos perigosos e mudanças',
        unidade: 'UN',
      },
      {
        codigo: '2.0102',
        descricao:
          'Serviços de transporte rodoviário de produtos perigosos',
        unidade: 'UN',
      },
      {
        codigo: '2.0201',
        descricao: 'Serviços de transporte rodoviário de passageiros',
        unidade: 'UN',
      },
      // TI e software
      {
        codigo: '1.0501',
        descricao:
          'Serviços de desenvolvimento de programas de computador sob encomenda',
        unidade: 'UN',
      },
      {
        codigo: '1.0502',
        descricao:
          'Serviços de desenvolvimento e licenciamento de programas de computador customizáveis',
        unidade: 'UN',
      },
      {
        codigo: '1.0503',
        descricao:
          'Serviços de suporte técnico, instalação, configuração e manutenção de programas de computador',
        unidade: 'HR',
      },
      {
        codigo: '1.0504',
        descricao:
          'Serviços de processamento de dados, hospedagem na internet e outras atividades relacionadas',
        unidade: 'UN',
      },
      {
        codigo: '1.0505',
        descricao: 'Serviços de infraestrutura de tecnologia da informação',
        unidade: 'MES',
      },
      // Engenharia e construção
      {
        codigo: '1.0301',
        descricao: 'Serviços de elaboração de projetos de engenharia civil',
        unidade: 'UN',
      },
      {
        codigo: '1.0302',
        descricao: 'Serviços de elaboração de projetos arquitetônicos',
        unidade: 'UN',
      },
      {
        codigo: '1.0303',
        descricao:
          'Serviços de supervisão e fiscalização de obras e serviços de engenharia',
        unidade: 'HR',
      },
      {
        codigo: '1.0304',
        descricao:
          'Serviços de instalação e montagem de estruturas metálicas e equipamentos industriais',
        unidade: 'UN',
      },
      // Saúde
      {
        codigo: '3.0101',
        descricao: 'Serviços de medicina — consultas médicas',
        unidade: 'UN',
      },
      {
        codigo: '3.0201',
        descricao: 'Serviços odontológicos',
        unidade: 'UN',
      },
      // Educação e treinamento
      {
        codigo: '4.0101',
        descricao: 'Serviços de treinamento e desenvolvimento profissional',
        unidade: 'UN',
      },
      {
        codigo: '4.0102',
        descricao: 'Serviços de educação continuada',
        unidade: 'HR',
      },
      // Limpeza e segurança
      {
        codigo: '1.1401',
        descricao: 'Serviços de limpeza em prédios e domicílios',
        unidade: 'MES',
      },
      {
        codigo: '1.1402',
        descricao:
          'Serviços de vigilância, segurança privada e transporte de valores',
        unidade: 'MES',
      },
      // Publicidade
      {
        codigo: '1.0801',
        descricao: 'Serviços de publicidade e propaganda',
        unidade: 'UN',
      },
      {
        codigo: '1.0802',
        descricao: 'Serviços de agências de publicidade',
        unidade: 'UN',
      },
      // Financeiro e seguros
      {
        codigo: '5.0101',
        descricao:
          'Serviços de intermediação e agenciamento de seguros e planos de saúde',
        unidade: 'UN',
      },
      {
        codigo: '5.0201',
        descricao: 'Serviços de cobrança',
        unidade: 'UN',
      },
      // Aluguel e locação
      {
        codigo: '6.0101',
        descricao: 'Serviços de aluguel de imóveis próprios',
        unidade: 'MES',
      },
      {
        codigo: '6.0201',
        descricao:
          'Serviços de locação de veículos automotores sem condutor',
        unidade: 'DIA',
      },
      {
        codigo: '6.0301',
        descricao:
          'Serviços de locação de máquinas e equipamentos sem operador',
        unidade: 'DIA',
      },
      // Profissões liberais
      {
        codigo: '1.0701',
        descricao: 'Serviços de advocacia',
        unidade: 'HR',
      },
      {
        codigo: '1.0702',
        descricao: 'Serviços de contabilidade',
        unidade: 'MES',
      },
      {
        codigo: '1.0703',
        descricao: 'Serviços de auditoria contábil e fiscal',
        unidade: 'UN',
      },
      {
        codigo: '1.0704',
        descricao: 'Serviços de assessoria e consultoria tributária',
        unidade: 'HR',
      },
    ];

    for (const nbs of nbsCodes) {
      await this.prisma.nbsCode.upsert({
        where: { codigo: nbs.codigo },
        update: {},
        create: nbs,
      });
    }

    return { message: `${nbsCodes.length} códigos NBS inseridos com sucesso` };
  }
}
