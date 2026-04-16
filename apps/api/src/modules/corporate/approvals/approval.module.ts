import { Module } from '@nestjs/common';
import { ApprovalController } from './approval.controller';
import { ApprovalConfigService } from './approval-config.service';
import { ApprovalEngineService } from './approval-engine.service';

@Module({
  controllers: [ApprovalController],
  providers: [ApprovalConfigService, ApprovalEngineService],
  exports: [ApprovalConfigService, ApprovalEngineService],
})
export class ApprovalModule {}
