import { Module } from '@nestjs/common';
import { ServiceOrderController } from './service-order.controller';
import { ServiceOrderService } from './service-order.service';
import { FiscalModule } from '@/modules/corporate/fiscal/fiscal.module';

@Module({
  imports: [FiscalModule],
  controllers: [ServiceOrderController],
  providers: [ServiceOrderService],
  exports: [ServiceOrderService],
})
export class ServiceOrderModule {}
