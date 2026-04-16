import { Module } from '@nestjs/common';
import { EngineeringService } from './engineering.service';
import { EngineeringController } from './engineering.controller';
import { EcoService } from './eco.service';
import { EcoController } from './eco.controller';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Module({
  controllers: [EngineeringController, EcoController],
  providers: [EngineeringService, EcoService, PrismaService],
  exports: [EcoService],
})
export class EngineeringModule {}
