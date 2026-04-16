import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SupplierQuotationItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  prazoEntrega?: number;

  @IsOptional()
  @IsString()
  observations?: string;
}

export class CreateSupplierQuotationDto {
  @IsString()
  purchaseRequestId: string;

  @IsString()
  supplierId: string;

  @IsOptional()
  @IsDateString()
  dataValidade?: string;

  @IsOptional()
  @IsString()
  condicaoPagamento?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierQuotationItemDto)
  items: SupplierQuotationItemDto[];
}
