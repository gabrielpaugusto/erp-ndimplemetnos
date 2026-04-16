import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StockLocationsController } from './stock-locations.controller';
import { StockLocationsService } from './stock-locations.service';
import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from './stock-movements.service';
import { StockBalancesController } from './stock-balances.controller';
import { StockBalancesService } from './stock-balances.service';
import { InventoriesController } from './inventories.controller';
import { InventoriesService } from './inventories.service';
import { StockAlertsController } from './stock-alerts.controller';
import { StockAlertsService } from './stock-alerts.service';
import { ProductGroupsController } from './product-groups.controller';
import { ProductGroupsService } from './product-groups.service';
import { StockReportsController } from './stock-reports.controller';
import { StockReportsService } from './stock-reports.service';
import { ProductAbbreviationsController } from './product-abbreviations.controller';
import { ProductAbbreviationsService } from './product-abbreviations.service';

@Module({
  controllers: [
    InventoryController,
    ProductsController,
    StockLocationsController,
    StockMovementsController,
    StockBalancesController,
    InventoriesController,
    StockAlertsController,
    ProductGroupsController,
    StockReportsController,
    ProductAbbreviationsController,
  ],
  providers: [
    InventoryService,
    ProductsService,
    StockLocationsService,
    StockMovementsService,
    StockBalancesService,
    InventoriesService,
    StockAlertsService,
    ProductGroupsService,
    StockReportsService,
    ProductAbbreviationsService,
  ],
  exports: [
    ProductsService,
    StockLocationsService,
    StockMovementsService,
    StockBalancesService,
    InventoriesService,
    StockAlertsService,
    ProductGroupsService,
    StockReportsService,
    ProductAbbreviationsService,
  ],
})
export class InventoryModule {}
