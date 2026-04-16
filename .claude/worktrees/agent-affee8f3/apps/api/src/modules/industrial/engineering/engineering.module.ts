import { Module } from '@nestjs/common';
import { EngineeringService } from './engineering.service';
import { EngineeringController } from './engineering.controller';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Module({
  controllers: [EngineeringController],
  providers: [EngineeringService, PrismaService],
})
export class EngineeringModule {}
