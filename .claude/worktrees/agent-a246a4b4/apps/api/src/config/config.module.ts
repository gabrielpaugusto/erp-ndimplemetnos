import { Module, Global, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { configValidationSchema } from './config.schema';
import { GovernmentConfigService } from './government.config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
  ],
  providers: [GovernmentConfigService],
  exports: [GovernmentConfigService],
})
export class AppConfigModule implements OnModuleInit {
  private readonly logger = new Logger(AppConfigModule.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly govConfig: GovernmentConfigService,
  ) {}

  onModuleInit() {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const govAmbiente = this.configService.get<string>('GOV_AMBIENTE');

    // FATAL: Nunca permitir ambiente de PRODUCAO em development
    if (nodeEnv === 'development' && govAmbiente === '1') {
      this.logger.error(
        '============================================================',
      );
      this.logger.error(
        'FATAL: GOV_AMBIENTE=1 (PRODUCAO) em NODE_ENV=development!',
      );
      this.logger.error(
        'Isso enviaria documentos fiscais REAIS para a SEFAZ.',
      );
      this.logger.error(
        'Altere GOV_AMBIENTE=2 no seu .env para usar homologacao.',
      );
      this.logger.error(
        '============================================================',
      );
      throw new Error(
        'GOV_AMBIENTE=1 (PRODUCAO) nao e permitido em NODE_ENV=development. ' +
          'Use GOV_AMBIENTE=2 (HOMOLOGACAO) para desenvolvimento.',
      );
    }

    // WARN: Producao com homologacao
    if (nodeEnv === 'production' && govAmbiente === '2') {
      this.logger.warn(
        '============================================================',
      );
      this.logger.warn(
        'ATENCAO: GOV_AMBIENTE=2 (HOMOLOGACAO) em NODE_ENV=production!',
      );
      this.logger.warn(
        'Documentos fiscais NAO serao enviados para a SEFAZ real.',
      );
      this.logger.warn(
        '============================================================',
      );
    }

    this.logger.log(
      `Ambiente configurado: NODE_ENV=${nodeEnv}, GOV_AMBIENTE=${govAmbiente} (${govAmbiente === '1' ? 'PRODUCAO' : 'HOMOLOGACAO'})`,
    );
  }
}
