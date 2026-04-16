import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateNcmDto {
  @IsString()
  @MaxLength(10)
  code: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsOptional()
  @IsString()
  exTipi?: string;

  // Substituição Tributária
  @IsOptional()
  @IsBoolean()
  temSt?: boolean;

  @IsOptional()
  @IsString()
  cestCode?: string;

  @IsOptional()
  @IsString()
  cestDescricao?: string;

  // Importação
  @IsOptional()
  @IsNumber()
  aliquotaImportacao?: number;

  // Geral
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
