import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export enum InsuranceTypeEnum {
  RCFV = 'RCFV',
  CASCO = 'CASCO',
  TOTAL = 'TOTAL',
  TRANSPORTE = 'TRANSPORTE',
  GARANTIA_ESTENDIDA = 'GARANTIA_ESTENDIDA',
}

export class CreateInsuranceDto {
  @IsString()
  personId: string;

  @IsOptional()
  @IsString()
  seguradoraId?: string;

  @IsEnum(InsuranceTypeEnum)
  type: InsuranceTypeEnum;

  @IsString()
  descricaoBem: string;

  @IsOptional()
  @IsInt()
  anoFabricacao?: number;

  @IsOptional()
  @IsString()
  chassi?: string;

  @IsOptional()
  @IsString()
  placa?: string;

  @IsNumber()
  @Min(0)
  valorBem: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  premio?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  franquia?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  importanciaSegurada?: number;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsString()
  saleOrderId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  comissaoPercent?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
