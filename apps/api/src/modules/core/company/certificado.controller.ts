import {
  Controller,
  Post,
  Delete,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CertificadoService } from './certificado.service';

@Controller('company/certificado')
@UseGuards(JwtAuthGuard)
export class CertificadoController {
  constructor(private readonly certificadoService: CertificadoService) {}

  @Get('status')
  async status(@Req() req: { user: { companyId: string } }) {
    return this.certificadoService.getStatus(req.user.companyId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('arquivo', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        const ext = '.' + (file.originalname.split('.').pop()?.toLowerCase() ?? '');
        const allowed = ['.pfx', '.p12'];
        if (allowed.includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Apenas arquivos .pfx ou .p12 são aceitos'), false);
        }
      },
    }),
  )
  async upload(
    @Req() req: { user: { companyId: string } },
    @UploadedFile() file: Express.Multer.File,
    @Body('senha') senha: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo do certificado é obrigatório');
    if (!senha) throw new BadRequestException('Senha do certificado é obrigatória');
    return this.certificadoService.upload(req.user.companyId, file.buffer, senha);
  }

  @Delete()
  async remove(@Req() req: { user: { companyId: string } }) {
    return this.certificadoService.remove(req.user.companyId);
  }
}
