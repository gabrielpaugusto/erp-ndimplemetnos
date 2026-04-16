import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { SaleOrdersController } from './sale-orders.controller';
import { SaleOrdersService } from './sale-orders.service';
import { CustomizationService } from './customization.service';
import { CustomizationController } from './customization.controller';
import { ApprovalModule } from '@/modules/corporate/approvals/approval.module';

@Module({
  imports: [ApprovalModule],
  controllers: [SalesController, QuotationsController, SaleOrdersController, CustomizationController],
  providers: [SalesService, QuotationsService, SaleOrdersService, CustomizationService],
  exports: [QuotationsService, SaleOrdersService, CustomizationService],
})
export class SalesModule {}
