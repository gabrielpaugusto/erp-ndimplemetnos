import { Module } from '@nestjs/common';
import { PcpController } from './pcp.controller';
import { PcpService } from './pcp.service';
import { WorkCentersController } from './work-centers.controller';
import { WorkCentersService } from './work-centers.service';
import { BomController } from './bom.controller';
import { BomService } from './bom.service';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';

@Module({
  controllers: [
    PcpController,
    WorkCentersController,
    BomController,
    RoutingController,
  ],
  providers: [
    PcpService,
    WorkCentersService,
    BomService,
    RoutingService,
  ],
  exports: [WorkCentersService, BomService, RoutingService],
})
export class PcpModule {}
