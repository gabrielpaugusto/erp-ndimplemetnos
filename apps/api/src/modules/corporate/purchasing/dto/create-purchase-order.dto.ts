import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsDateString,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum FinalidadeOperacaoEnum {
  INDUSTRIALIZACAO   = 'INDUSTRIALIZACAO',
  REVENDA            = 'REVENDA',
  USO_CONSUMO        = 'USO_CONSUMO',
  ATIVO_IMOBILIZADO  = 'ATIVO_IMOBILIZADO',
}

export enum ItemDestinacaoEnum {
  MATERIA_PRIMA = 'MATERIA_PRIMA',
  COMPONENTE = 'COMPONENTE',
  PRODUTO_REVENDA = 'PRODUTO_REVENDA',
  INSUMO_PRODUCAO = 'INSUMO_PRODUCAO',
  EMBALAGEM = 'EMBALAGEM',
  MATERIAL_USO_CONSUMO = 'MATERIAL_USO_CONSUMO',
  GGF = 'GGF',
  IMOBILIZADO = 'IMOBILIZADO',
  SERVICO = 'SERVICO',
}

/**
 * Destinações que geram movimentação de estoque no recebimento físico e na escrituração fiscal.
 * GGF (Gastos Gerais de Fabricação) controla estoque → entra em 1.1.4 (Almoxarifado GGF)
 * e só vai para custo de produção quando requisitado via RGGF.
 */
export const DESTINACOES_COM_ESTOQUE = [
  ItemDestinacaoEnum.MATERIA_PRIMA,
  ItemDestinacaoEnum.COMPONENTE,
  ItemDestinacaoEnum.PRODUTO_REVENDA,
  ItemDestinacaoEnum.INSUMO_PRODUCAO,
  ItemDestinacaoEnum.EMBALAGEM,
  ItemDestinacaoEnum.GGF,          // A7: GGF controla estoque — CFOP 1101, crédito ICMS
];

export class PurchaseOrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsString()
  @MaxLength(20)
  unit: string;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  icms?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ipi?: number;

  @IsOptional()
  @IsEnum(ItemDestinacaoEnum)
  destinacao?: ItemDestinacaoEnum;

  @IsOptional()
  @IsString()
  observations?: string;
}

export class CreatePurchaseOrderDto {
  @IsString()
  supplierId: string;

  @IsOptional()
  @IsString()
  purchaseRequestId?: string;

  @IsOptional()
  @IsDateString()
  dataEntregaPrevista?: string;

  @IsOptional()
  @IsString()
  condicaoPagamento?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  frete?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  desconto?: number;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsEnum(FinalidadeOperacaoEnum)
  finalidadeOperacao?: FinalidadeOperacaoEnum;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}
