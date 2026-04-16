import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';

export enum PointingType {
  MAO_DE_OBRA = 'MAO_DE_OBRA',
  MATERIAL = 'MATERIAL',
  SETUP = 'SETUP',
  PARADA = 'PARADA',
}

export class CreatePointingDto {
  @IsString()
  productionOrderId: string;

  @IsString()
  workCenterId: string;

  @IsEnum(PointingType)
  type: PointingType;

  @IsDateString()
  dataInicio: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityProduced?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityRejected?: number;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsString()
  motivoParada?: string;
}
