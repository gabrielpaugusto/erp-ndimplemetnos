import { Module } from '@nestjs/common';
import { EngineeringService } from './engineering.service';
import { EngineeringController } from './engineering.controller';
import { EcoService } from './eco.service';
import { EcoController } from './eco.controller';

@Module({
  controllers: [EngineeringController, EcoController],
  providers: [EngineeringService, EcoService],
  exports: [EcoService],
})
export class EngineeringModule {}
