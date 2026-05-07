import { Module } from '@nestjs/common';
import { FiscalService } from './fiscal.service';
import { FiscalController } from './fiscal.controller';
import { NcmController } from './ncm.controller';
import { NcmService } from './ncm.service';
import { TaxEngineService } from './tax-engine.service';
import { NfeController } from './nfe/nfe.controller';
import { NfeService } from './nfe/nfe.service';
import { NfeXmlBuilderService } from './nfe/nfe-xml-builder.service';
import { NfeSignerService } from './nfe/nfe-signer.service';
import { DanfeService } from './nfe/danfe.service';
import { DifalService } from './nfe/difal.service';
import { NfeIaPipelineSaidaService } from './nfe/nfe-ia-pipeline-saida.service';
import { FiscalBooksController } from './books/fiscal-books.controller';
import { FiscalBooksService } from './books/fiscal-books.service';
import { FiscalEngineAutomationService } from './fiscal-engine.service';
import { FiscalEngineController } from './fiscal-engine.controller';
import { OperacoesFiscaisService } from './operacoes-fiscais.service';
import { OperacoesFiscaisController } from './operacoes-fiscais.controller';
import { GovernmentTransmissionModule } from './government/government-transmission.module';
import { CompanyModule } from '@/modules/core/company/company.module';
import { NfseModule } from './nfse/nfse.module';
import { FiscalBrainModule } from './fiscal-brain/fiscal-brain.module';
import { StProtocoloController } from './st-protocolo.controller';
import { StProtocoloService } from './st-protocolo.service';
import { STDetectorService } from './st-detector.service';
import { CbenefController } from './cbenef.controller';
import { CbenefService } from './cbenef.service';

@Module({
  imports: [GovernmentTransmissionModule, CompanyModule, NfseModule, FiscalBrainModule],
  controllers: [
    FiscalController,
    NcmController,
    NfeController,
    FiscalBooksController,
    FiscalEngineController,
    OperacoesFiscaisController,
    StProtocoloController,
    CbenefController,
  ],
  providers: [
    FiscalService,
    NcmService,
    TaxEngineService,
    NfeService,
    NfeXmlBuilderService,
    NfeSignerService,
    DanfeService,
    DifalService,
    NfeIaPipelineSaidaService,
    FiscalBooksService,
    FiscalEngineAutomationService,
    OperacoesFiscaisService,
    StProtocoloService,
    STDetectorService,
    CbenefService,
  ],
  exports: [NcmService, TaxEngineService, NfeService, FiscalEngineAutomationService, OperacoesFiscaisService, GovernmentTransmissionModule, NfseModule, FiscalBrainModule, StProtocoloService, STDetectorService, CbenefService],
})
export class FiscalModule {}
