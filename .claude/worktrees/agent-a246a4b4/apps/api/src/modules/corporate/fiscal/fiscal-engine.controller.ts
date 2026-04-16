import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  FiscalEngineAutomationService,
  FiscalContext,
  FiscalItemInput,
  OperationType,
} from './fiscal-engine.service';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';

const OPERATION_TYPES: OperationType[] = [
  'SAIDA_VENDA_PRODUCAO',
  'SAIDA_VENDA_MERCADORIA',
  'SAIDA_VENDA_PECA',
  'SAIDA_SERVICO',
  'SAIDA_DEVOLUCAO_COMPRA',
  'SAIDA_REMESSA_INDUSTRIA',
  'SAIDA_REMESSA_CONSERTO',
  'SAIDA_TRANSFERENCIA',
  'ENTRADA_COMPRA_INDUSTRIA',
  'ENTRADA_COMPRA_COMERCIO',
  'ENTRADA_DEVOLUCAO_VENDA',
  'ENTRADA_RETORNO_INDUSTRIA',
  'ENTRADA_RETORNO_CONSERTO',
  'ENTRADA_TRANSFERENCIA',
];

class FiscalItemInputDto implements FiscalItemInput {
  @IsOptional() @IsString()
  productId?: string;

  @IsOptional() @IsString()
  ncmCode?: string;

  @IsString()
  description!: string;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  unitPrice!: number;

  @IsOptional() @IsString()
  origem?: string;

  @IsOptional() @IsString()
  productType?: string;
}

class FiscalPreviewDto {
  @IsString()
  companyId!: string;

  @IsString()
  ufEmitente!: string;

  @IsString()
  ufDestinatario!: string;

  @IsOptional() @IsBoolean()
  destinatarioContribuinte?: boolean;

  @IsOptional() @IsBoolean()
  exterior?: boolean;

  @IsEnum(OPERATION_TYPES as any)
  operationType!: OperationType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FiscalItemInputDto)
  items!: FiscalItemInputDto[];
}

@UseGuards(JwtAuthGuard)
@Controller('api/fiscal/engine')
export class FiscalEngineController {
  constructor(private readonly engine: FiscalEngineAutomationService) {}

  /**
   * POST /api/fiscal/engine/preview
   * Resolve campos fiscais de uma lista de itens sem persistir nada.
   * Usado por: orçamentos, pedidos, NF-e (pré-preenchimento automático).
   */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async preview(@Body() dto: FiscalPreviewDto) {
    const context: FiscalContext = {
      companyId: dto.companyId,
      ufEmitente: dto.ufEmitente,
      ufDestinatario: dto.ufDestinatario,
      destinatarioContribuinte: dto.destinatarioContribuinte,
      exterior: dto.exterior,
      operationType: dto.operationType,
      date: new Date(),
    };

    const results = await Promise.all(
      dto.items.map((item) => this.engine.resolveItem(context, item)),
    );

    return { items: results };
  }

  /**
   * GET /api/fiscal/engine/cfop?operationType=SAIDA_VENDA_PRODUCAO&ufEmitente=RS&ufDestinatario=SP
   * Retorna apenas o CFOP calculado (útil para dropdowns).
   */
  @Get('cfop')
  resolveCfop(
    @Query('operationType') operationType: string,
    @Query('ufEmitente') ufEmitente: string,
    @Query('ufDestinatario') ufDestinatario: string,
    @Query('exterior') exterior?: string,
  ) {
    const cfopCode = this.engine.resolveCfop({
      operationType: operationType as OperationType,
      ufEmitente,
      ufDestinatario,
      exterior: exterior === 'true',
    });

    return { cfopCode };
  }

  /**
   * GET /api/fiscal/engine/operation-types
   * Retorna lista de tipos de operação disponíveis (para dropdowns no frontend).
   */
  @Get('operation-types')
  getOperationTypes() {
    const labels: Record<string, string> = {
      SAIDA_VENDA_PRODUCAO: 'Venda de Produção Própria',
      SAIDA_VENDA_MERCADORIA: 'Venda de Mercadoria (Revenda)',
      SAIDA_VENDA_PECA: 'Venda de Peça de Reposição',
      SAIDA_SERVICO: 'Prestação de Serviço',
      SAIDA_DEVOLUCAO_COMPRA: 'Devolução a Fornecedor',
      SAIDA_REMESSA_INDUSTRIA: 'Remessa para Industrialização',
      SAIDA_REMESSA_CONSERTO: 'Remessa para Conserto / Reparo',
      SAIDA_TRANSFERENCIA: 'Transferência para Filial',
      ENTRADA_COMPRA_INDUSTRIA: 'Compra para Industrialização',
      ENTRADA_COMPRA_COMERCIO: 'Compra para Comercialização',
      ENTRADA_DEVOLUCAO_VENDA: 'Devolução de Venda Recebida',
      ENTRADA_RETORNO_INDUSTRIA: 'Retorno de Industrialização',
      ENTRADA_RETORNO_CONSERTO: 'Retorno de Conserto',
      ENTRADA_TRANSFERENCIA: 'Recebimento de Transferência',
    };

    return OPERATION_TYPES.map((value) => ({
      value,
      label: labels[value] ?? value,
      direction: value.startsWith('SAIDA_') ? 'SAIDA' : 'ENTRADA',
    }));
  }
}
