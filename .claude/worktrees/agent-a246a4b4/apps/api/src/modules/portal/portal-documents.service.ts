import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ShareDocumentDto } from './dto/share-document.dto';

@Injectable()
export class PortalDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async share(companyId: string, dto: ShareDocumentDto) {
    // Verify person exists
    const person = await this.prisma.person.findUnique({
      where: { id: dto.personId },
    });

    if (!person) {
      throw new NotFoundException(`Person ${dto.personId} not found`);
    }

    // Find portal user for this person (optional — doc is linked to person)
    const portalUser = await this.prisma.portalUser.findFirst({
      where: { companyId, personId: dto.personId },
    });

    return this.prisma.portalDocument.create({
      data: {
        companyId,
        personId: dto.personId,
        portalUserId: portalUser?.id,
        title: dto.title,
        description: dto.description,
        fileUrl: dto.fileUrl,
        fileType: dto.fileType,
        fileSize: dto.fileSize,
        category: dto.category,
        saleOrderId: dto.saleOrderId,
        nfeDocumentId: dto.nfeDocumentId,
        serviceOrderId: dto.serviceOrderId,
      },
      include: {
        person: {
          select: { id: true, razaoSocial: true, cpfCnpj: true },
        },
      },
    });
  }

  async getMyDocuments(
    portalUserId: string,
    personId: string,
    query: { category?: string; page?: string; limit?: string },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { personId };
    if (query.category) {
      where.category = query.category;
    }

    const [data, total] = await Promise.all([
      this.prisma.portalDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.portalDocument.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async download(id: string) {
    const document = await this.prisma.portalDocument.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    // Increment download count
    await this.prisma.portalDocument.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });

    return document;
  }

  async getByPerson(
    companyId: string,
    personId: string,
    query: { category?: string; page?: string; limit?: string },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId, personId };
    if (query.category) {
      where.category = query.category;
    }

    const [data, total] = await Promise.all([
      this.prisma.portalDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          person: {
            select: { id: true, razaoSocial: true, cpfCnpj: true },
          },
        },
      }),
      this.prisma.portalDocument.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
