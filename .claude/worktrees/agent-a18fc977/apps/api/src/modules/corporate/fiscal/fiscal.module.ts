import { Module } from '@nestjs/common';
import { FiscalService } from './fiscal.service';
import { FiscalController } from './fiscal.controller';
import { NcmController } from './ncm.controller';
import { NcmService } from './ncm.service';
import { CfopController } from './cfop.controller';
import { CfopService } from './cfop.service';
import { TaxEngineService } from './tax-engine.service';
import { NfeController } from './nfe/nfe.controller';
import { NfeService } from './nfe/nfe.service';
import { NfeXmlBuilderService } from './nfe/nfe-xml-builder.service';
import { NfeSignerService } from './nfe/nfe-signer.service';
import { DanfeService } from './nfe/danfe.service';
import { DifalService } from './nfe/difal.service';
import { FiscalBooksController } from './books/fiscal-books.controller';
import { FiscalBooksService } from './books/fiscal-books.service';
import { TaxRulesController } from './rules/tax-rules.controller';
import { TaxRulesService } from './rules/tax-rules.service';
import { FiscalEngineAutomationService } from './fiscal-engine.service';
import { FiscalEngineController } from './fiscal-engine.controller';
import { GovernmentTransmissionModule } from './government/government-transmission.module';
import { CompanyModule } from '@/modules/core/company/company.module';

@Module({
  imports: [GovernmentTransmissionModule, CompanyModule],
  controllers: [
    FiscalController,
    NcmController,
    CfopController,
    NfeController,
    FiscalBooksController,
    TaxRulesController,
    FiscalEngineController,
  ],
  providers: [
    FiscalService,
    NcmService,
    CfopService,
    TaxEngineService,
    NfeService,
    NfeXmlBuilderService,
    NfeSignerService,
    DanfeService,
    DifalService,
    FiscalBooksService,
    TaxRulesService,
    FiscalEngineAutomationService,
  ],
  exports: [NcmService, CfopService, TaxEngineService, NfeService, FiscalEngineAutomationService, GovernmentTransmissionModule],
})
export class FiscalModule {}
