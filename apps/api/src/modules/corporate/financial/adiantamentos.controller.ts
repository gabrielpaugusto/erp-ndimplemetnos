import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { AdiantamentosService } from './adiantamentos.service';
import { CreateAdiantamentoMovimentoDto } from './dto/create-adiantamento-movimento.dto';

@UseGuards(JwtAuthGuard)
@Controller('financial/adiantamentos')
export class AdiantamentosController {
  constructor(private readonly service: AdiantamentosService) {}

  // GET /financial/adiantamentos/resumo
  @Get('resumo')
  resumo(@CurrentUser() user: any) {
    return this.service.resumo(user.companyId);
  }

  // GET /financial/adiantamentos?tipo=CLIENTE|FORNECEDOR
  @Get()
  findAll(@CurrentUser() user: any, @Query('tipo') tipo?: string) {
    return this.service.findAll(user.companyId, tipo);
  }

  // GET /financial/adiantamentos/:personId/:tipo
  @Get(':personId/:tipo')
  findByPerson(
    @CurrentUser() user: any,
    @Param('personId') personId: string,
    @Param('tipo') tipo: string,
  ) {
    return this.service.findByPerson(user.companyId, personId, tipo.toUpperCase());
  }

  // POST /financial/adiantamentos/:personId/:tipo/creditar
  @Post(':personId/:tipo/creditar')
  creditar(
    @CurrentUser() user: any,
    @Param('personId') personId: string,
    @Param('tipo') tipo: string,
    @Body() dto: CreateAdiantamentoMovimentoDto,
  ) {
    return this.service.creditar(
      user.companyId,
      personId,
      tipo.toUpperCase(),
      { ...dto, tipo: 'CREDITO' as any },
      user.id,
    );
  }

  // POST /financial/adiantamentos/:personId/:tipo/debitar
  @Post(':personId/:tipo/debitar')
  debitar(
    @CurrentUser() user: any,
    @Param('personId') personId: string,
    @Param('tipo') tipo: string,
    @Body() dto: CreateAdiantamentoMovimentoDto,
  ) {
    return this.service.debitar(
      user.companyId,
      personId,
      tipo.toUpperCase(),
      { ...dto, tipo: 'DEBITO' as any },
      user.id,
    );
  }

  // POST /financial/adiantamentos/movimentos/:movimentoId/estornar
  @Post('movimentos/:movimentoId/estornar')
  estornar(
    @CurrentUser() user: any,
    @Param('movimentoId') movimentoId: string,
  ) {
    return this.service.estornar(movimentoId, user.companyId, user.id);
  }
}
