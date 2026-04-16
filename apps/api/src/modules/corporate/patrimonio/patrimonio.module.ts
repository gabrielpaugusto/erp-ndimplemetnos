import { Module } from '@nestjs/common';
import { FixedAssetsController } from './fixed-assets.controller';
import { FixedAssetsService } from './fixed-assets.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  controllers: [FixedAssetsController, MaintenanceController],
  providers: [FixedAssetsService, MaintenanceService],
  exports: [FixedAssetsService, MaintenanceService],
})
export class PatrimonioModule {}
