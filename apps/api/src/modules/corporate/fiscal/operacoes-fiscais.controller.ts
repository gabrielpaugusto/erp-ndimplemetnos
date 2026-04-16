import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { OperacoesFiscaisService } from './operacoes-fiscais.service';
import { CreateOperacaoFiscalDto, UpdateOperacaoFiscalDto, DeterminarOperacaoDto } from './dto/operacao-fiscal.dto';

@UseGuards(JwtAuthGuard)
@Controller('fiscal/operacoes-fiscais')
export class OperacoesFiscaisController {
  constructor(private readonly svc: OperacoesFiscaisService) {}

  /** Lista todas as operações fiscais da empresa */
  @Get()
  findAll(@Request() req: any) {
    return this.svc.findAll(req.user.companyId);
  }

  /** Motor: determina a operação fiscal para um item */
  @Get('determinar')
  determinar(@Request() req: any, @Query() dto: DeterminarOperacaoDto) {
    return this.svc.determinar(req.user.companyId, dto as any);
  }

  /** Inserir regras padrão do sistema para esta empresa */
  @Post('seed-padrao')
  seedPadrao(@Request() req: any) {
    return this.svc.seedRegrasPadrao(req.user.companyId);
  }

  /** Detalhe de uma operação */
  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.svc.findOne(req.user.companyId, id);
  }

  /** Criar nova operação fiscal customizada */
  @Post()
  create(@Request() req: any, @Body() dto: CreateOperacaoFiscalDto) {
    return this.svc.create(req.user.companyId, dto);
  }

  /** Atualizar operação fiscal */
  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateOperacaoFiscalDto) {
    return this.svc.update(req.user.companyId, id, dto);
  }

  /** Remover operação fiscal (apenas não-padrão) */
  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.companyId, id);
  }
}
