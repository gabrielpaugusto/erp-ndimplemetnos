import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

/** Statuses that allow a Financing record to be hard-deleted. */
const DELETABLE_STATUSES = ['SIMULACAO', 'CANCELADO', 'RECUSADO'];

@Injectable()
export class FiService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string, companyId: string) {
    const record = await this.prisma.financing.findUnique({ where: { id } });
    if (!record || record.companyId !== companyId) {
      throw new NotFoundException(`Financing ${id} não encontrado`);
    }
    return record;
  }

  async remove(id: string, companyId: string) {
    const record = await this.findOne(id, companyId);

    if (!DELETABLE_STATUSES.includes(record.status)) {
      throw new BadRequestException(
        `Não é possível excluir um financing com status "${record.status}". ` +
          `Permitido apenas: ${DELETABLE_STATUSES.join(', ')}`,
      );
    }

    return this.prisma.financing.delete({ where: { id } });
  }
}
