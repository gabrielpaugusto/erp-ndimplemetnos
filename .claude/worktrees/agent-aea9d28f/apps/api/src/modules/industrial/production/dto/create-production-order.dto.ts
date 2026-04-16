import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  IsDateString,
  Min,
} from 'class-validator';

export enum ProductionStrategy {
  MTO = 'MTO',
  ATO = 'ATO',
  MTS = 'MTS',
}

export enum ProductionOrderType {
  NORMAL = 'NORMAL',
  RETRABALHO = 'RETRABALHO',
  PROTOTIPO = 'PROTOTIPO',
}

export class CreateProductionOrderDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  routingId?: string;

  @IsOptional()
  @IsString()
  saleOrderId?: string;

  @IsEnum(ProductionStrategy)
  strategy: ProductionStrategy;

  @IsOptional()
  @IsEnum(ProductionOrderType)
  type?: ProductionOrderType;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsDateString()
  dataInicioPrevista: string;

  @IsDateString()
  dataFimPrevista: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
