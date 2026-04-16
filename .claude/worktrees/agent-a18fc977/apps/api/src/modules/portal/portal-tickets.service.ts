import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';

@Injectable()
export class PortalTicketsService {
  constructor(private readonly prisma: PrismaService) {}

  // Portal user: list their own tickets
  async findByPortalUser(
    portalUserId: string,
    query: { status?: string; page?: string; limit?: string },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { portalUserId };
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.portalTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.portalTicket.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // Internal: list all tickets for company
  async findAll(
    companyId: string,
    query: {
      status?: string;
      priority?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.search) {
      where.OR = [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.portalTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          portalUser: {
            select: { id: true, name: true, email: true },
          },
          assignedTo: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.portalTicket.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const ticket = await this.prisma.portalTicket.findUnique({
      where: { id },
      include: {
        portalUser: {
          select: { id: true, name: true, email: true },
        },
        assignedTo: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            portalUser: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return ticket;
  }

  // Portal user: get their own ticket (hides internal messages)
  async findOneForPortal(id: string, portalUserId: string) {
    const ticket = await this.prisma.portalTicket.findFirst({
      where: { id, portalUserId },
      include: {
        assignedTo: { select: { id: true, name: true } },
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: 'asc' },
          include: {
            portalUser: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return ticket;
  }

  async create(
    portalUserId: string,
    companyId: string,
    dto: CreateTicketDto,
  ) {
    return this.prisma.portalTicket.create({
      data: {
        companyId,
        portalUserId,
        subject: dto.subject,
        description: dto.description,
        priority: (dto.priority as any) || 'MEDIA',
        category: dto.category,
      },
      include: {
        portalUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async addMessage(
    ticketId: string,
    dto: CreateTicketMessageDto,
    options: {
      portalUserId?: string;
      userId?: string;
      isInternal?: boolean;
    },
  ) {
    const ticket = await this.prisma.portalTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    const message = await this.prisma.portalTicketMessage.create({
      data: {
        ticketId,
        content: dto.content,
        portalUserId: options.portalUserId,
        userId: options.userId,
        isInternal: options.isInternal ?? false,
      },
      include: {
        portalUser: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    // Update ticket status if portal user responds and it was RESPONDIDO
    if (options.portalUserId && ticket.status === 'RESPONDIDO') {
      await this.prisma.portalTicket.update({
        where: { id: ticketId },
        data: { status: 'EM_ANDAMENTO' },
      });
    }

    // Update ticket status if internal user responds and it was ABERTO or EM_ANDAMENTO
    if (
      options.userId &&
      !options.isInternal &&
      ['ABERTO', 'EM_ANDAMENTO'].includes(ticket.status)
    ) {
      await this.prisma.portalTicket.update({
        where: { id: ticketId },
        data: { status: 'RESPONDIDO' },
      });
    }

    return message;
  }

  async assign(ticketId: string, assignedToId: string) {
    const ticket = await this.prisma.portalTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    return this.prisma.portalTicket.update({
      where: { id: ticketId },
      data: {
        assignedToId,
        status: ticket.status === 'ABERTO' ? 'EM_ANDAMENTO' : undefined,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    });
  }

  async close(ticketId: string) {
    const ticket = await this.prisma.portalTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    return this.prisma.portalTicket.update({
      where: { id: ticketId },
      data: { status: 'FECHADO', closedAt: new Date() },
    });
  }

  async getStats(companyId: string) {
    const [byStatus, byPriority, totalOpen] = await Promise.all([
      this.prisma.portalTicket.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { id: true },
      }),
      this.prisma.portalTicket.groupBy({
        by: ['priority'],
        where: { companyId, status: { not: 'FECHADO' } },
        _count: { id: true },
      }),
      this.prisma.portalTicket.count({
        where: { companyId, status: { not: 'FECHADO' } },
      }),
    ]);

    return {
      totalOpen,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      byPriority: byPriority.map((p) => ({
        priority: p.priority,
        count: p._count.id,
      })),
    };
  }
}
