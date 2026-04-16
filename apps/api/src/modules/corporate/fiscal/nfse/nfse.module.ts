import { Module } from '@nestjs/common';
import { NfseService } from './nfse.service';
import { NfseController } from './nfse.controller';
import { NfseRfbClientService } from './nfse-rfb-client.service';
import { NfseXmlBuilderService } from './nfse-xml-builder.service';
import { NbsService } from './nbs.service';
import { NbsController } from './nbs.controller';
import { Lc116Service } from './lc116.service';
import { Lc116Controller } from './lc116.controller';
import { OperacoesFiscaisService } from '../operacoes-fiscais.service';

@Module({
  controllers: [NfseController, NbsController, Lc116Controller],
  providers: [NfseService, NfseRfbClientService, NfseXmlBuilderService, NbsService, Lc116Service, OperacoesFiscaisService],
  exports: [NfseService, NbsService, Lc116Service],
})
export class NfseModule {}
