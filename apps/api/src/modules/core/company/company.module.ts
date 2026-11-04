import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { CertificadoService } from './certificado.service';
import { CertificadoController } from './certificado.controller';

@Module({
  controllers: [CompanyController, CertificadoController],
  providers: [CompanyService, CertificadoService],
  exports: [CompanyService, CertificadoService],
})
export class CompanyModule {}
