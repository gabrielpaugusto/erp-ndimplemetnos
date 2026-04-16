import { Module } from '@nestjs/common';
import { PcpController } from './pcp.controller';
import { PcpService } from './pcp.service';
import { WorkCentersController } from './work-centers.controller';
import { WorkCentersService } from './work-centers.service';
import { BomController } from './bom.controller';
import { BomService } from './bom.service';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { BomOverrideService } from './bom-override.service';
import { MrpService } from './mrp.service';
import { MrpController } from './mrp.controller';

@Module({
  controllers: [
    PcpController,
    WorkCentersController,
    BomController,
    RoutingController,
    MrpController,         // Sprint 4.2
  ],
  providers: [
    PcpService,
    WorkCentersService,
    BomService,
    RoutingService,
    BomOverrideService,    // Sprint 3.1
    MrpService,            // Sprint 4.2
  ],
  exports: [WorkCentersService, BomService, RoutingService, BomOverrideService, MrpService],
})
export class PcpModule {}
