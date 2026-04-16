import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSaleOrderItemDto } from './create-sale-order-item.dto';

export enum SaleTypeEnum {
  ESTOQUE_PROPRIO = 'ESTOQUE_PROPRIO',
  VENDA_DIRETA = 'VENDA_DIRETA',
  PRODUCAO_PROPRIA = 'PRODUCAO_PROPRIA',
}

export class CreateSaleOrderDto {
  @IsString()
  personId: string;

  @IsOptional()
  @IsEnum(SaleTypeEnum)
  saleType?: SaleTypeEnum;

  @IsOptional()
  @IsString()
  condicaoPagamento?: string;

  @IsOptional()
  @IsString()
  prazoEntrega?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsString()
  vendedorId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  comissaoPercent?: number;

  @IsOptional()
  @IsString()
  fabricanteId?: string;

  @IsOptional()
  @IsString()
  costCenterCode?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleOrderItemDto)
  items?: CreateSaleOrderItemDto[];
}
