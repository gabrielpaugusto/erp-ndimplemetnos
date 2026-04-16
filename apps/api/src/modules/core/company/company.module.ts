import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { CertificadoService } from './certificado.service';
import { CertificadoController } from './certificado.controller';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Module({
  controllers: [CompanyController, CertificadoController],
  providers: [CompanyService, CertificadoService, PrismaService],
  exports: [CompanyService, CertificadoService],
})
export class CompanyModule {}
