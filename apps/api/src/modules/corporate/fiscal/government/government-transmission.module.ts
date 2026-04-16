import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SefazClientService } from './sefaz/sefaz-client.service';
import { NfseClientService } from './nfse/nfse-client.service';
import { SpedFiscalService } from './sped/sped-fiscal.service';
import { SpedContribuicoesService } from './sped/sped-contribuicoes.service';
import { SpedController } from './sped/sped.controller';
import { EcdService } from './sped/ecd.service';
import { EcfService } from './sped/ecf.service';
// A14 — eSocial
import { EsocialClientService } from './esocial/esocial-client.service';
import { EsocialEventsService } from './esocial/esocial-events.service';
import { EsocialController } from './esocial/esocial.controller';
// A14 — REINF
import { ReinfClientService } from './reinf/reinf-client.service';
import { ReinfEventsService } from './reinf/reinf-events.service';
import { ReinfController } from './reinf/reinf.controller';
// A14 — DCTF-Web
import { DctfwebClientService } from './dctfweb/dctfweb-client.service';
import { DctfwebController } from './dctfweb/dctfweb.controller';

const services = [
  SefazClientService,
  NfseClientService,
  SpedFiscalService,
  SpedContribuicoesService,
  EcdService,
  EcfService,
  // A14
  EsocialClientService,
  EsocialEventsService,
  ReinfClientService,
  ReinfEventsService,
  DctfwebClientService,
];

@Module({
  imports: [ConfigModule],
  controllers: [SpedController, EsocialController, ReinfController, DctfwebController],
  providers: [...services],
  exports: [...services],
})
export class GovernmentTransmissionModule {}
