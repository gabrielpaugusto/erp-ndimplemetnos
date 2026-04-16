import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { SaleOrdersController } from './sale-orders.controller';
import { SaleOrdersService } from './sale-orders.service';

@Module({
  controllers: [SalesController, QuotationsController, SaleOrdersController],
  providers: [SalesService, QuotationsService, SaleOrdersService],
  exports: [QuotationsService, SaleOrdersService],
})
export class SalesModule {}
