import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}
