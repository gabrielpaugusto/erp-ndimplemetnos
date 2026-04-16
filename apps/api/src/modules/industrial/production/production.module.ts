import { Module } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { ProductionOrdersController } from './production-orders.controller';
import { ProductionOrdersService } from './production-orders.service';
import { PointingController } from './pointing.controller';
import { PointingService } from './pointing.service';
import { PcpModule } from '@/modules/industrial/pcp/pcp.module';

@Module({
  imports: [PcpModule],   // Sprint 3.1 — BomOverrideService
  controllers: [
    ProductionController,
    ProductionOrdersController,
    PointingController,
  ],
  providers: [
    ProductionService,
    ProductionOrdersService,
    PointingService,
  ],
  exports: [ProductionOrdersService, PointingService],
})
export class ProductionModule {}
