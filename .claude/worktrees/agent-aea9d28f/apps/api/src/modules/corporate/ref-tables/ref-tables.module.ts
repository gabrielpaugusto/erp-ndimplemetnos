import { Module } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CstIcmsController } from './cst-icms/cst-icms.controller';
import { CstIcmsService } from './cst-icms/cst-icms.service';
import { CsosnController } from './csosn/csosn.controller';
import { CsosnService } from './csosn/csosn.service';
import { CstIpiController } from './cst-ipi/cst-ipi.controller';
import { CstIpiService } from './cst-ipi/cst-ipi.service';
import { CstPisCofinsController } from './cst-pis-cofins/cst-pis-cofins.controller';
import { CstPisCofinsService } from './cst-pis-cofins/cst-pis-cofins.service';
import { CestController } from './cest/cest.controller';
import { CestService } from './cest/cest.service';
import { IcmsInterestadualController } from './icms-interestadual/icms-interestadual.controller';
import { IcmsInterestadualService } from './icms-interestadual/icms-interestadual.service';
import { BancoController } from './banco/banco.controller';
import { BancoService } from './banco/banco.service';
import { PaisController } from './pais/pais.controller';
import { PaisService } from './pais/pais.service';

@Module({
  controllers: [
    CstIcmsController, CsosnController, CstIpiController,
    CstPisCofinsController, CestController, IcmsInterestadualController,
    BancoController, PaisController,
  ],
  providers: [
    PrismaService,
    CstIcmsService, CsosnService, CstIpiService,
    CstPisCofinsService, CestService, IcmsInterestadualService,
    BancoService, PaisService,
  ],
  exports: [
    CstIcmsService, CsosnService, CstIpiService,
    CstPisCofinsService, CestService, IcmsInterestadualService,
    BancoService, PaisService,
  ],
})
export class RefTablesModule {}
