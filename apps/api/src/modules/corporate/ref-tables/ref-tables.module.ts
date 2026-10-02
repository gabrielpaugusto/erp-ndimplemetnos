import { Module } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { CestController } from './cest/cest.controller';
import { CestService } from './cest/cest.service';
import { BancoController } from './banco/banco.controller';
import { BancoService } from './banco/banco.service';
import { PaisController } from './pais/pais.controller';
import { PaisService } from './pais/pais.service';
import { NaturezaJuridicaController } from './natureza-juridica/natureza-juridica.controller';
import { NaturezaJuridicaService } from './natureza-juridica/natureza-juridica.service';
import { RamoAtividadeController } from './ramo-atividade/ramo-atividade.controller';
import { RamoAtividadeService } from './ramo-atividade/ramo-atividade.service';

@Module({
  controllers: [
    CestController,
    BancoController,
    PaisController,
    NaturezaJuridicaController,
    RamoAtividadeController,
  ],
  providers: [
    PrismaService,
    CestService,
    BancoService,
    PaisService,
    NaturezaJuridicaService,
    RamoAtividadeService,
  ],
  exports: [
    CestService,
    BancoService,
    PaisService,
    NaturezaJuridicaService,
    RamoAtividadeService,
  ],
})
export class RefTablesModule {}
