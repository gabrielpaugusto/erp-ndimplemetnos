import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';

@Injectable()
export class JournalEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateNumero(companyId: string): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');
    const prefix = `LC-${dateStr}`;

    const lastEntry = await this.prisma.journalEntry.findFirst({
      where: {
        companyId,
        numero: { startsWith: prefix },
      },
      orderBy: { numero: 'desc' },
    });

    let seq = 1;
    if (lastEntry) {
      const parts = lastEntry.numero.split('-');
      seq = parseInt(parts[parts.length - 1], 10) + 1;
    }

    return `${prefix}-${seq.toString().padStart(3, '0')}`;
  }

  async findAll(
    companyId: string,
    query: {
      status?: string;
      accountId?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.accountId) {
      where.items = { some: { accountId: query.accountId } };
    }

    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) {
        where.date.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.date.lte = new Date(query.dateTo);
      }
    }

    if (query.search) {
      where.OR = [
        { numero: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          items: {
            include: {
              account: { select: { id: true, code: true, name: true } },
            },
          },
          user: { select: { id: true, name: true } },
        },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            account: { select: { id: true, code: true, name: true } },
            costCenter: { select: { id: true, code: true, name: true } },
          },
        },
        user: { select: { id: true, name: true } },
        reversalOf: { select: { id: true, numero: true } },
        reversals: { select: { id: true, numero: true } },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }

    return entry;
  }

  async create(
    companyId: string,
    userId: string,
    data: CreateJournalEntryDto,
  ) {
    // Validate debit = credit
    const totalDebito = data.items
      .filter((i) => i.type === 'DEVEDORA')
      .reduce((sum, i) => sum + i.value, 0);
    const totalCredito = data.items
      .filter((i) => i.type === 'CREDORA')
      .reduce((sum, i) => sum + i.value, 0);

    if (Math.abs(totalDebito - totalCredito) > 0.01) {
      throw new BadRequestException(
        `Total debits (${totalDebito}) must equal total credits (${totalCredito})`,
      );
    }

    const numero = await this.generateNumero(companyId);

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          userId,
          numero,
          date: new Date(data.date),
          description: data.description,
          totalValue: totalDebito,
          items: {
            create: data.items.map((item) => ({
              accountId: item.accountId,
              type: item.type as any,
              value: item.value,
              costCenterId: item.costCenterId,
              description: item.description,
            })),
          },
        },
        include: {
          items: {
            include: {
              account: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });

      return entry;
    });
  }

  async update(id: string, data: UpdateJournalEntryDto) {
    const existing = await this.prisma.journalEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }

    if (existing.status !== 'RASCUNHO') {
      throw new BadRequestException(
        'Only draft entries can be updated',
      );
    }

    const updateData: any = {};

    if (data.date) {
      updateData.date = new Date(data.date);
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.items) {
      const totalDebito = data.items
        .filter((i) => i.type === 'DEVEDORA')
        .reduce((sum, i) => sum + i.value, 0);
      const totalCredito = data.items
        .filter((i) => i.type === 'CREDORA')
        .reduce((sum, i) => sum + i.value, 0);

      if (Math.abs(totalDebito - totalCredito) > 0.01) {
        throw new BadRequestException(
          `Total debits (${totalDebito}) must equal total credits (${totalCredito})`,
        );
      }

      updateData.totalValue = totalDebito;

      return this.prisma.$transaction(async (tx) => {
        await tx.journalEntryItem.deleteMany({
          where: { journalEntryId: id },
        });

        return tx.journalEntry.update({
          where: { id },
          data: {
            ...updateData,
            items: {
              create: data.items!.map((item) => ({
                accountId: item.accountId,
                type: item.type as any,
                value: item.value,
                costCenterId: item.costCenterId,
                description: item.description,
              })),
            },
          },
          include: {
            items: {
              include: {
                account: { select: { id: true, code: true, name: true } },
              },
            },
          },
        });
      });
    }

    return this.prisma.journalEntry.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
  }

  async post(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }

    if (entry.status !== 'RASCUNHO') {
      throw new BadRequestException(
        'Only draft entries can be posted',
      );
    }

    return this.prisma.journalEntry.update({
      where: { id },
      data: { status: 'LANCADO' },
      include: {
        items: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
  }

  async reverse(id: string, companyId: string, userId: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }

    if (entry.status !== 'LANCADO') {
      throw new BadRequestException(
        'Only posted entries can be reversed',
      );
    }

    const numero = await this.generateNumero(companyId);

    return this.prisma.$transaction(async (tx) => {
      // Mark original as reversed
      await tx.journalEntry.update({
        where: { id },
        data: { status: 'ESTORNADO' },
      });

      // Create reversal entry with swapped debit/credit
      const reversal = await tx.journalEntry.create({
        data: {
          companyId,
          userId,
          numero,
          date: new Date(),
          description: `Estorno de ${entry.numero}: ${entry.description}`,
          status: 'LANCADO',
          totalValue: entry.totalValue,
          reversalOfId: id,
          items: {
            create: entry.items.map((item) => ({
              accountId: item.accountId,
              type: item.type === 'DEVEDORA' ? 'CREDORA' : 'DEVEDORA',
              value: item.value,
              costCenterId: item.costCenterId,
              description: `Estorno: ${item.description || ''}`,
            })),
          },
        },
        include: {
          items: {
            include: {
              account: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });

      return reversal;
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.journalEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }

    if (existing.status !== 'RASCUNHO') {
      throw new BadRequestException(
        'Only draft entries can be deleted',
      );
    }

    return this.prisma.journalEntry.delete({ where: { id } });
  }
}
