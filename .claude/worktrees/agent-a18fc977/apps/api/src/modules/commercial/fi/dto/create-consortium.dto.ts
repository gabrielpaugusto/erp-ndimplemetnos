import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class CreateConsortiumDto {
  @IsString()
  personId: string;

  @IsOptional()
  @IsString()
  administradoraId?: string;

  @IsString()
  grupo: string;

  @IsString()
  cota: string;

  @IsNumber()
  @Min(0)
  valorCredito: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  parcelasMensais?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorParcelaMensal?: number;

  @IsOptional()
  @IsString()
  saleOrderId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  comissaoPercent?: number;

  @IsOptional()
  @IsDateString()
  dataAdesao?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
