import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getHealth() {
    const govAmbiente = this.configService.get('GOV_AMBIENTE', '2');
    const nodeEnv = this.configService.get('NODE_ENV', 'development');

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv,
        govAmbiente: govAmbiente === '1' ? 'PRODUCAO' : 'HOMOLOGACAO',
        govAmbienteCode: govAmbiente,
      },
      version: '1.0.0',
      modules: {
        nfe: true,
        nfse: true,
        sped: true,
        esocial: true,
        reinf: true,
        dctfweb: true,
      },
    };
  }
}
