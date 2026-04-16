import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { EngineeringService } from './engineering.service';

@Controller('engineering')
@UseGuards(JwtAuthGuard)
export class EngineeringController {
  constructor(private readonly engineeringService: EngineeringService) {}

  // Status do módulo
  @Get()
  status() { return { module: 'Engineering', status: 'active' }; }

  // Dashboard consolidado de engenharia
  @Get('dashboard')
  getDashboard(@CurrentUser() user: { companyId: string }) {
    return this.engineeringService.getDashboard(user.companyId);
  }

  // Lista de produtos com indicação de BOM e Roteiro
  @Get('products')
  getProducts(
    @CurrentUser() user: { companyId: string },
    @Query('search') search?: string,
    @Query('type')   type?: string,
    @Query('page')   page?: string,
    @Query('limit')  limit?: string,
  ) {
    return this.engineeringService.getProductsWithEngineering(user.companyId, {
      search, type, page, limit,
    });
  }

  // ── Importação de BOM do SolidWorks ──────────────────────────────────────────

  // Faz parse do arquivo Excel e retorna preview (sem gravar no banco)
  @Post('bom/parse')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  parseBom(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    return this.engineeringService.parseBomFile(file.buffer);
  }

  // Importa BOM confirmada para o banco
  @Post('bom/import')
  importBom(
    @CurrentUser() user: { companyId: string },
    @Body() body: { productId: string; rows: any[]; description?: string },
  ) {
    if (!body.productId) throw new BadRequestException('productId é obrigatório.');
    return this.engineeringService.importBom(
      user.companyId,
      body.productId,
      body.rows,
      body.description,
    );
  }
}
