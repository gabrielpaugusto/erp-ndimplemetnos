import { Module } from '@nestjs/common';
import { PurchaseRequestsController } from './purchase-requests.controller';
import { PurchaseRequestsService } from './purchase-requests.service';
import { SupplierQuotationsController } from './supplier-quotations.controller';
import { SupplierQuotationsService } from './supplier-quotations.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { ProductSuppliersController } from './product-suppliers.controller';
import { ProductSuppliersService } from './product-suppliers.service';
import { NfeInboxController } from './nfe-inbox.controller';
import { NfeInboxService } from './nfe-inbox.service';
import { CteController } from './cte.controller';
import { CteService } from './cte.service';

@Module({
  controllers: [
    PurchaseRequestsController,
    SupplierQuotationsController,
    PurchaseOrdersController,
    ProductSuppliersController,
    NfeInboxController,
    CteController,
  ],
  providers: [
    PurchaseRequestsService,
    SupplierQuotationsService,
    PurchaseOrdersService,
    ProductSuppliersService,
    NfeInboxService,
    CteService,
  ],
  exports: [
    PurchaseRequestsService,
    SupplierQuotationsService,
    PurchaseOrdersService,
    ProductSuppliersService,
    NfeInboxService,
    CteService,
  ],
})
export class PurchasingModule {}
