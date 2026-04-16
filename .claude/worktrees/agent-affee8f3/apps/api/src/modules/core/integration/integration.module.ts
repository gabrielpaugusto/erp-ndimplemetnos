import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '@/modules/core/database/database.module';
import { IntegrationService } from './integration.service';
import { IntegrationConfigService } from './integration-config.service';
import { SaleIntegrationService } from './sale-integration.service';
import { PurchaseIntegrationService } from './purchase-integration.service';

/**
 * IntegrationModule is global so services can be injected
 * into any module without explicit imports, avoiding circular dependencies.
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [IntegrationService, IntegrationConfigService, SaleIntegrationService, PurchaseIntegrationService],
  exports: [IntegrationService, SaleIntegrationService, PurchaseIntegrationService],
})
export class IntegrationModule {}
