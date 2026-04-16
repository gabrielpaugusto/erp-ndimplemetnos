import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        companyId,
        type: (dto.type as any) || 'INFO',
        title: dto.title,
        message: dto.message,
        link: dto.link,
        userId: dto.userId,
        portalUserId: dto.portalUserId,
      },
    });
  }

  async getUnread(options: { userId?: string; portalUserId?: string }) {
    const where: any = { read: false };
    if (options.userId) where.userId = options.userId;
    if (options.portalUserId) where.portalUserId = options.portalUserId;

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getAll(
    options: { userId?: string; portalUserId?: string },
    query: { page?: string; limit?: string },
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.userId) where.userId = options.userId;
    if (options.portalUserId) where.portalUserId = options.portalUserId;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async markAsRead(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    return this.prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllAsRead(options: { userId?: string; portalUserId?: string }) {
    const where: any = { read: false };
    if (options.userId) where.userId = options.userId;
    if (options.portalUserId) where.portalUserId = options.portalUserId;

    return this.prisma.notification.updateMany({
      where,
      data: { read: true, readAt: new Date() },
    });
  }

  async getCount(options: { userId?: string; portalUserId?: string }) {
    const where: any = { read: false };
    if (options.userId) where.userId = options.userId;
    if (options.portalUserId) where.portalUserId = options.portalUserId;

    return { count: await this.prisma.notification.count({ where }) };
  }
}
