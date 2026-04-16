import { Module } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CestController } from './cest/cest.controller';
import { CestService } from './cest/cest.service';
import { BancoController } from './banco/banco.controller';
import { BancoService } from './banco/banco.service';
import { PaisController } from './pais/pais.controller';
import { PaisService } from './pais/pais.service';

@Module({
  controllers: [
    CestController,
    BancoController, PaisController,
  ],
  providers: [
    PrismaService,
    CestService,
    BancoService, PaisService,
  ],
  exports: [
    CestService,
    BancoService, PaisService,
  ],
})
export class RefTablesModule {}
