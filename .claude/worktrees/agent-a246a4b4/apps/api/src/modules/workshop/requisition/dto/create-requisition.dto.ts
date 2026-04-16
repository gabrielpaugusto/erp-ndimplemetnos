import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum RequisitionType {
  INTERNA = 'INTERNA',
  COMPRA = 'COMPRA',
  TRANSFERENCIA = 'TRANSFERENCIA',
}

export class CreateRequisitionItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0.01)
  quantityRequested: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateRequisitionDto {
  @IsEnum(RequisitionType)
  type: RequisitionType;

  @IsOptional()
  @IsString()
  serviceOrderId?: string;

  @IsOptional()
  @IsString()
  calderariaOrderId?: string;

  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  justificativa?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequisitionItemDto)
  items: CreateRequisitionItemDto[];
}
