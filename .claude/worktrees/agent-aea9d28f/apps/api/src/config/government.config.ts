import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GovernmentEnvironment } from './government-environment.enum';

@Injectable()
export class GovernmentConfigService {
  constructor(private readonly configService: ConfigService) {}

  getAmbiente(): GovernmentEnvironment {
    return this.configService.get<string>('GOV_AMBIENTE') as GovernmentEnvironment;
  }

  getNfeAmbiente(): GovernmentEnvironment {
    const nfeAmbiente = this.configService.get<string>('NFE_AMBIENTE');
    return (nfeAmbiente || this.getAmbiente()) as GovernmentEnvironment;
  }

  getEsocialUrl(): string {
    const ambiente =
      (this.configService.get<string>('ESOCIAL_AMBIENTE') as GovernmentEnvironment) ||
      this.getAmbiente();

    return ambiente === GovernmentEnvironment.PRODUCAO
      ? this.configService.get<string>('ESOCIAL_URL_PROD', '')
      : this.configService.get<string>('ESOCIAL_URL_HOM', '');
  }

  getReinfUrl(): string {
    const ambiente =
      (this.configService.get<string>('REINF_AMBIENTE') as GovernmentEnvironment) ||
      this.getAmbiente();

    return ambiente === GovernmentEnvironment.PRODUCAO
      ? this.configService.get<string>('REINF_URL_PROD', '')
      : this.configService.get<string>('REINF_URL_HOM', '');
  }

  getSpedIndicador(): string {
    const ambiente =
      (this.configService.get<string>('SPED_AMBIENTE') as GovernmentEnvironment) ||
      this.getAmbiente();

    // SPED: 0 = producao, 1 = homologacao
    return ambiente === GovernmentEnvironment.PRODUCAO ? '0' : '1';
  }

  isProducao(): boolean {
    return this.getAmbiente() === GovernmentEnvironment.PRODUCAO;
  }

  isHomologacao(): boolean {
    return this.getAmbiente() === GovernmentEnvironment.HOMOLOGACAO;
  }

  getCertificadoPath(): string {
    return this.configService.get<string>('GOV_CERTIFICADO_A1_PATH', '');
  }

  getCertificadoSenha(): string {
    return this.configService.get<string>('GOV_CERTIFICADO_A1_SENHA', '');
  }
}
