import { Module } from '@nestjs/common';

// Config
import { AppConfigModule } from './config/config.module';

// Core
import { DatabaseModule } from './modules/core/database/database.module';
import { AuthModule } from './modules/core/auth/auth.module';
import { IntegrationModule } from './modules/core/integration/integration.module';

// Industrial
import { EngineeringModule } from './modules/industrial/engineering/engineering.module';
import { PcpModule } from './modules/industrial/pcp/pcp.module';
import { ProductionModule } from './modules/industrial/production/production.module';
import { QualityModule } from './modules/industrial/quality/quality.module';
import { ApontamentosModule } from './modules/industrial/apontamentos/apontamentos.module';

// Commercial
import { CrmModule } from './modules/commercial/crm/crm.module';
import { SalesModule } from './modules/commercial/sales/sales.module';
import { FiModule } from './modules/commercial/fi/fi.module';

// Workshop
import { ServiceOrderModule } from './modules/workshop/service-order/service-order.module';
import { CalderariaModule } from './modules/workshop/calderaria/calderaria.module';
import { RequisitionModule } from './modules/workshop/requisition/requisition.module';

// Corporate
import { FiscalModule } from './modules/corporate/fiscal/fiscal.module';
import { RefTablesModule } from './modules/corporate/ref-tables/ref-tables.module';
import { AccountingModule } from './modules/corporate/accounting/accounting.module';
import { FinancialModule } from './modules/corporate/financial/financial.module';
import { HrModule } from './modules/corporate/hr/hr.module';
import { PurchasingModule } from './modules/corporate/purchasing/purchasing.module';
import { InventoryModule } from './modules/corporate/inventory/inventory.module';

// AI
import { AiAssistantModule } from './modules/ai/assistant/assistant.module';

// Portal
import { PortalModule } from './modules/portal/portal.module';

// Health
import { HealthModule } from './modules/core/health/health.module';
import { CompanyModule } from './modules/core/company/company.module';
import { UsersModule } from './modules/core/users/users.module';
import { RolesModule } from './modules/core/roles/roles.module';

@Module({
  imports: [
    AppConfigModule,

    // Core
    DatabaseModule,
    AuthModule,
    HealthModule,
    CompanyModule,
    UsersModule,
    RolesModule,
    IntegrationModule,

    // Industrial
    EngineeringModule,
    PcpModule,
    ProductionModule,
    QualityModule,
    ApontamentosModule,

    // Commercial
    CrmModule,
    SalesModule,
    FiModule,

    // Workshop
    ServiceOrderModule,
    CalderariaModule,
    RequisitionModule,

    // Corporate
    FiscalModule,
    RefTablesModule,
    AccountingModule,
    FinancialModule,
    HrModule,
    PurchasingModule,
    InventoryModule,

    // AI
    AiAssistantModule,

    // Portal
    PortalModule,
  ],
})
export class AppModule {}
