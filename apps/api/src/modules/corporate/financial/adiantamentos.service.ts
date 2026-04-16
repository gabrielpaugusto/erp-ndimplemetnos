import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateAdiantamentoMovimentoDto } from './dto/create-adiantamento-movimento.dto';

// Nomes padronizados das contas contábeis de adiantamento
const CONTA_ADT_CLIENTES    = 'Adiantamentos de Clientes';
const CONTA_ADT_FORNECEDOR  = 'Adiantamentos a Fornecedores';
const CONTA_BANCO_PADRAO    = 'Bancos';
const CONTA_CLIENTES        = 'Clientes';
const CONTA_FORNECEDORES    = 'Fornecedores';

@Injectable()
export class AdiantamentosService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Gerar número de lançamento contábil ───────────────────────────────────
  private async gerarNumeroLC(companyId: string, tx: any): Promise<string> {
    const today  = new Date();
    const prefix = `LC-ADT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const last   = await tx.journalEntry.findFirst({
      where: { companyId, numero: { startsWith: prefix } },
      orderBy: { numero: 'desc' },
    });
    const seq = last ? parseInt(last.numero.split('-').pop()!, 10) + 1 : 1;
    return `${prefix}-${String(seq).padStart(3, '0')}`;
  }

  // ── Buscar ou criar conta no plano de contas ──────────────────────────────
  private async resolverConta(
    companyId: string,
    name: string,
    type: 'ATIVO' | 'PASSIVO' | 'RECEITA' | 'DESPESA',
    nature: 'DEVEDORA' | 'CREDORA',
    tx: any,
  ): Promise<string> {
    // Busca por nome exato (case-insensitive)
    let conta = await tx.chartOfAccount.findFirst({
      where: { companyId, name: { contains: name, mode: 'insensitive' } },
    });

    // Se não existe, cria automaticamente
    if (!conta) {
      // Gerar código sequencial
      const last = await tx.chartOfAccount.findFirst({
        where: { companyId, type },
        orderBy: { code: 'desc' },
      });
      const code = last
        ? String(parseInt(last.code, 10) + 1).padStart(last.code.length, '0')
        : type === 'ATIVO' ? '1.999' : type === 'PASSIVO' ? '2.999' : '4.999';

      conta = await tx.chartOfAccount.create({
        data: {
          companyId,
          code,
          name,
          type,
          nature,
          level: 2,
          acceptsEntries: true,
          active: true,
        },
      });
    }

    return conta.id;
  }

  // ── Gerar lançamento contábil automático ──────────────────────────────────
  // Regras contábeis:
  //
  // CLIENTE — CRÉDITO (recebimento antecipado):
  //   D: Banco/Caixa (Ativo)
  //   C: Adiantamentos de Clientes (Passivo)
  //
  // CLIENTE — DÉBITO (aplicação contra faturamento):
  //   D: Adiantamentos de Clientes (Passivo)
  //   C: Clientes / Contas a Receber (Ativo)
  //
  // FORNECEDOR — CRÉDITO (pagamento antecipado):
  //   D: Adiantamentos a Fornecedores (Ativo)
  //   C: Banco/Caixa (Ativo)
  //
  // FORNECEDOR — DÉBITO (aplicação contra NF do fornecedor):
  //   D: Fornecedores / Contas a Pagar (Passivo)
  //   C: Adiantamentos a Fornecedores (Ativo)
  private async gerarLancamentoContabil(
    companyId: string,
    userId: string,
    tipo: 'CLIENTE' | 'FORNECEDOR',
    movTipo: 'CREDITO' | 'DEBITO',
    valor: number,
    data: Date,
    descricao: string,
    referencia: string | undefined,
    tx: any,
  ): Promise<string> {
    const numero = await this.gerarNumeroLC(companyId, tx);

    // Resolver contas conforme o cenário
    let contaDevedoraId: string;
    let contaCredoraId: string;

    if (tipo === 'CLIENTE' && movTipo === 'CREDITO') {
      // D: Banco · C: Adiantamentos de Clientes
      contaDevedoraId = await this.resolverConta(companyId, CONTA_BANCO_PADRAO, 'ATIVO', 'DEVEDORA', tx);
      contaCredoraId  = await this.resolverConta(companyId, CONTA_ADT_CLIENTES, 'PASSIVO', 'CREDORA', tx);
    } else if (tipo === 'CLIENTE' && movTipo === 'DEBITO') {
      // D: Adiantamentos de Clientes · C: Clientes
      contaDevedoraId = await this.resolverConta(companyId, CONTA_ADT_CLIENTES, 'PASSIVO', 'CREDORA', tx);
      contaCredoraId  = await this.resolverConta(companyId, CONTA_CLIENTES, 'ATIVO', 'DEVEDORA', tx);
    } else if (tipo === 'FORNECEDOR' && movTipo === 'CREDITO') {
      // D: Adiantamentos a Fornecedores · C: Banco
      contaDevedoraId = await this.resolverConta(companyId, CONTA_ADT_FORNECEDOR, 'ATIVO', 'DEVEDORA', tx);
      contaCredoraId  = await this.resolverConta(companyId, CONTA_BANCO_PADRAO, 'ATIVO', 'DEVEDORA', tx);
    } else {
      // FORNECEDOR / DEBITO — D: Fornecedores · C: Adiantamentos a Fornecedores
      contaDevedoraId = await this.resolverConta(companyId, CONTA_FORNECEDORES, 'PASSIVO', 'CREDORA', tx);
      contaCredoraId  = await this.resolverConta(companyId, CONTA_ADT_FORNECEDOR, 'ATIVO', 'DEVEDORA', tx);
    }

    const entry = await tx.journalEntry.create({
      data: {
        companyId,
        userId,
        numero,
        date: data,
        description: `${descricao}${referencia ? ` — Ref: ${referencia}` : ''}`,
        status: 'LANCADO',
        totalValue: valor,
        items: {
          create: [
            {
              accountId: contaDevedoraId,
              type: 'DEVEDORA',
              value: valor,
              description: descricao,
            },
            {
              accountId: contaCredoraId,
              type: 'CREDORA',
              value: valor,
              description: descricao,
            },
          ],
        },
      },
    });

    return entry.id;
  }

  // ── Buscar ou criar conta corrente ─────────────────────────────────────────
  private async upsertConta(companyId: string, personId: string, tipo: string, tx: any) {
    return tx.adiantamento.upsert({
      where: { companyId_personId_tipo: { companyId, personId, tipo: tipo as any } },
      create: { companyId, personId, tipo: tipo as any, saldoTotal: 0, saldoUtilizado: 0, saldoDisponivel: 0 },
      update: {},
    });
  }

  // ── Listar contas correntes (por tipo) ────────────────────────────────────
  async findAll(companyId: string, tipo?: string) {
    return this.prisma.adiantamento.findMany({
      where: { companyId, ...(tipo ? { tipo: tipo as any } : {}) },
      include: {
        person: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
        movimentos: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { bankAccount: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ tipo: 'asc' }, { saldoDisponivel: 'desc' }],
    });
  }

  // ── Buscar conta corrente de uma pessoa ───────────────────────────────────
  async findByPerson(companyId: string, personId: string, tipo: string) {
    const conta = await this.prisma.adiantamento.findUnique({
      where: { companyId_personId_tipo: { companyId, personId, tipo: tipo as any } },
      include: {
        person: { select: { id: true, razaoSocial: true, cpfCnpj: true } },
        movimentos: {
          orderBy: { data: 'desc' },
          include: {
            bankAccount: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
            journalEntry: { select: { id: true, numero: true, status: true } },
          },
        },
      },
    });

    if (!conta) {
      const person = await this.prisma.person.findUnique({
        where: { id: personId },
        select: { id: true, razaoSocial: true, cpfCnpj: true },
      });
      if (!person) throw new NotFoundException('Pessoa não encontrada');
      return {
        id: null, companyId, personId, tipo, person,
        saldoTotal: 0, saldoUtilizado: 0, saldoDisponivel: 0,
        status: 'ATIVO', movimentos: [],
      };
    }

    return conta;
  }

  // ── Lançar CRÉDITO ────────────────────────────────────────────────────────
  async creditar(
    companyId: string,
    personId: string,
    tipo: string,
    dto: CreateAdiantamentoMovimentoDto,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const conta = await this.upsertConta(companyId, personId, tipo, tx);

      // Lançamento contábil automático
      const journalEntryId = await this.gerarLancamentoContabil(
        companyId, userId,
        tipo as 'CLIENTE' | 'FORNECEDOR',
        'CREDITO',
        dto.valor,
        new Date(dto.data),
        dto.descricao,
        dto.referencia,
        tx,
      );

      const mov = await tx.adiantamentoMovimento.create({
        data: {
          adiantamentoId: conta.id,
          companyId,
          tipo: 'CREDITO',
          valor: dto.valor,
          data: new Date(dto.data),
          descricao: dto.descricao,
          referencia: dto.referencia,
          bankAccountId: dto.bankAccountId,
          paymentMethod: dto.paymentMethod as any,
          userId,
          journalEntryId,
          observations: dto.observations,
        },
        include: {
          bankAccount: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          journalEntry: { select: { id: true, numero: true } },
        },
      });

      const novoSaldoTotal      = Number(conta.saldoTotal) + dto.valor;
      const novoSaldoDisponivel = novoSaldoTotal - Number(conta.saldoUtilizado);

      const contaAtualizada = await tx.adiantamento.update({
        where: { id: conta.id },
        data: { saldoTotal: novoSaldoTotal, saldoDisponivel: novoSaldoDisponivel, status: 'ATIVO' },
        include: { person: { select: { id: true, razaoSocial: true, cpfCnpj: true } } },
      });

      return { conta: contaAtualizada, movimento: mov };
    });
  }

  // ── Lançar DÉBITO ─────────────────────────────────────────────────────────
  async debitar(
    companyId: string,
    personId: string,
    tipo: string,
    dto: CreateAdiantamentoMovimentoDto,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const conta = await tx.adiantamento.findUnique({
        where: { companyId_personId_tipo: { companyId, personId, tipo: tipo as any } },
      });

      if (!conta) throw new NotFoundException('Conta corrente de adiantamento não encontrada');
      if (conta.status === 'CANCELADO') throw new BadRequestException('Conta corrente cancelada');

      const saldoDisponivel = Number(conta.saldoDisponivel);
      if (dto.valor > saldoDisponivel) {
        throw new BadRequestException(`Saldo insuficiente. Disponível: R$ ${saldoDisponivel.toFixed(2)}`);
      }

      // Lançamento contábil automático
      const journalEntryId = await this.gerarLancamentoContabil(
        companyId, userId,
        tipo as 'CLIENTE' | 'FORNECEDOR',
        'DEBITO',
        dto.valor,
        new Date(dto.data),
        dto.descricao,
        dto.referencia,
        tx,
      );

      const mov = await tx.adiantamentoMovimento.create({
        data: {
          adiantamentoId: conta.id,
          companyId,
          tipo: 'DEBITO',
          valor: dto.valor,
          data: new Date(dto.data),
          descricao: dto.descricao,
          referencia: dto.referencia,
          bankAccountId: dto.bankAccountId,
          paymentMethod: dto.paymentMethod as any,
          userId,
          journalEntryId,
          observations: dto.observations,
        },
        include: {
          bankAccount: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
          journalEntry: { select: { id: true, numero: true } },
        },
      });

      const novoSaldoUtilizado  = Number(conta.saldoUtilizado) + dto.valor;
      const novoSaldoDisponivel = Number(conta.saldoTotal) - novoSaldoUtilizado;
      const novoStatus          = novoSaldoDisponivel <= 0 ? 'ENCERRADO' : 'ATIVO';

      const contaAtualizada = await tx.adiantamento.update({
        where: { id: conta.id },
        data: {
          saldoUtilizado: novoSaldoUtilizado,
          saldoDisponivel: Math.max(0, novoSaldoDisponivel),
          status: novoStatus,
        },
        include: { person: { select: { id: true, razaoSocial: true, cpfCnpj: true } } },
      });

      return { conta: contaAtualizada, movimento: mov };
    });
  }

  // ── Estornar movimento ────────────────────────────────────────────────────
  async estornar(movimentoId: string, companyId: string, userId: string) {
    const mov = await this.prisma.adiantamentoMovimento.findUnique({
      where: { id: movimentoId },
      include: { adiantamento: true, journalEntry: { include: { items: true } } },
    });

    if (!mov) throw new NotFoundException('Movimento não encontrado');
    if (mov.companyId !== companyId) throw new BadRequestException('Acesso negado');

    return this.prisma.$transaction(async (tx) => {
      const conta = mov.adiantamento;
      const valor = Number(mov.valor);

      // Estorno contábil — inverter as partidas do lançamento original
      if (mov.journalEntry) {
        const numero = await this.gerarNumeroLC(companyId, tx);
        await tx.journalEntry.create({
          data: {
            companyId,
            userId,
            numero,
            date: new Date(),
            description: `Estorno de ${mov.journalEntry.numero}: ${mov.descricao}`,
            status: 'LANCADO',
            totalValue: valor,
            reversalOfId: mov.journalEntry.id,
            items: {
              create: mov.journalEntry.items.map((item) => ({
                accountId: item.accountId,
                type: item.type === 'DEVEDORA' ? 'CREDORA' : 'DEVEDORA',
                value: item.value,
                description: `Estorno: ${item.description || ''}`,
              })),
            },
          },
        });

        await tx.journalEntry.update({
          where: { id: mov.journalEntry.id },
          data: { status: 'ESTORNADO' },
        });
      }

      // Movimento de estorno na conta corrente
      await tx.adiantamentoMovimento.create({
        data: {
          adiantamentoId: conta.id,
          companyId,
          tipo: mov.tipo === 'CREDITO' ? 'DEBITO' : 'CREDITO',
          valor,
          data: new Date(),
          descricao: `ESTORNO — ${mov.descricao}`,
          referencia: mov.referencia,
          userId,
          observations: `Estorno do movimento ${movimentoId}`,
        },
      });

      // Recalcular saldo
      let novoSaldoTotal      = Number(conta.saldoTotal);
      let novoSaldoUtilizado  = Number(conta.saldoUtilizado);
      if (mov.tipo === 'CREDITO') novoSaldoTotal -= valor;
      else novoSaldoUtilizado -= valor;

      const novoSaldoDisponivel = novoSaldoTotal - novoSaldoUtilizado;
      const novoStatus          = novoSaldoDisponivel <= 0 ? 'ENCERRADO' : 'ATIVO';

      const contaAtualizada = await tx.adiantamento.update({
        where: { id: conta.id },
        data: {
          saldoTotal: novoSaldoTotal,
          saldoUtilizado: novoSaldoUtilizado,
          saldoDisponivel: Math.max(0, novoSaldoDisponivel),
          status: novoStatus,
        },
        include: { person: { select: { id: true, razaoSocial: true, cpfCnpj: true } } },
      });

      return { conta: contaAtualizada };
    });
  }

  // ── Resumo geral ──────────────────────────────────────────────────────────
  async resumo(companyId: string) {
    const contas = await this.prisma.adiantamento.findMany({
      where: { companyId, status: 'ATIVO' },
      select: { tipo: true, saldoTotal: true, saldoUtilizado: true, saldoDisponivel: true },
    });

    const clientes    = contas.filter((c) => c.tipo === 'CLIENTE');
    const fornecedores = contas.filter((c) => c.tipo === 'FORNECEDOR');
    const sum = (arr: typeof contas, field: keyof (typeof arr)[0]) =>
      arr.reduce((acc, c) => acc + Number(c[field]), 0);

    return {
      clientes: {
        contas: clientes.length,
        saldoTotal: sum(clientes, 'saldoTotal'),
        saldoUtilizado: sum(clientes, 'saldoUtilizado'),
        saldoDisponivel: sum(clientes, 'saldoDisponivel'),
      },
      fornecedores: {
        contas: fornecedores.length,
        saldoTotal: sum(fornecedores, 'saldoTotal'),
        saldoUtilizado: sum(fornecedores, 'saldoUtilizado'),
        saldoDisponivel: sum(fornecedores, 'saldoDisponivel'),
      },
    };
  }
}
