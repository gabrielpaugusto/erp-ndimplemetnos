import {
  IsString,
  IsOptional,
  IsNumber,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateApuracaoDto {
  @IsString()
  @MaxLength(7)
  periodoReferencia: string;

  @IsString()
  @MaxLength(10)
  taxType: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  saldoAnterior?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deducoesLegais?: number;

  @IsOptional()
  @IsNumber()
  ajustesDebito?: number;

  @IsOptional()
  @IsNumber()
  ajustesCredito?: number;
}

export class CloseApuracaoDto {
  @IsString()
  @MaxLength(7)
  periodoReferencia: string;

  @IsString()
  @MaxLength(10)
  taxType: string;
}
