import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export enum FinancingTypeEnum {
  FINAME = 'FINAME',
  CDC = 'CDC',
  LEASING = 'LEASING',
  CONSORCIO = 'CONSORCIO',
  DIRETO = 'DIRETO',
}

export class CreateFinancingDto {
  @IsString()
  personId: string;

  @IsOptional()
  @IsString()
  saleOrderId?: string;

  @IsEnum(FinancingTypeEnum)
  type: FinancingTypeEnum;

  @IsOptional()
  @IsString()
  financeiraId?: string;

  @IsNumber()
  @Min(0)
  valorBem: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorEntrada?: number;

  @IsNumber()
  @Min(0)
  valorFinanciado: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxaJuros?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  parcelas?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorParcela?: number;

  @IsOptional()
  @IsString()
  codigoFiname?: string;

  @IsOptional()
  @IsString()
  linhaCredito?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  carencia?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  comissaoPercent?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
