import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SefazClientService } from './sefaz/sefaz-client.service';
import { NfseClientService } from './nfse/nfse-client.service';
import { SpedFiscalService } from './sped/sped-fiscal.service';
import { SpedContribuicoesService } from './sped/sped-contribuicoes.service';
import { EcdService } from './sped/ecd.service';
import { EcfService } from './sped/ecf.service';
import { EsocialClientService } from './esocial/esocial-client.service';
import { ReinfClientService } from './reinf/reinf-client.service';
import { DctfwebClientService } from './dctfweb/dctfweb-client.service';

const services = [
  SefazClientService,
  NfseClientService,
  SpedFiscalService,
  SpedContribuicoesService,
  EcdService,
  EcfService,
  EsocialClientService,
  ReinfClientService,
  DctfwebClientService,
];

@Module({
  imports: [ConfigModule],
  providers: [...services],
  exports: [...services],
})
export class GovernmentTransmissionModule {}
