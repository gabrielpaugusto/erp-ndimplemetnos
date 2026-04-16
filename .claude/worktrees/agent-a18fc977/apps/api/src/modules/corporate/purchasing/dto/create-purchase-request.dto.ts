import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseRequestItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsString()
  @MaxLength(20)
  unit: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedPrice?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreatePurchaseRequestDto {
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  justificativa?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequestItemDto)
  items: PurchaseRequestItemDto[];
}
