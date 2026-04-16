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

  // IPI
  @IsOptional()
  @IsNumber()
  aliquotaIpi?: number;

  @IsOptional()
  @IsString()
  cstIpiEntrada?: string;

  @IsOptional()
  @IsString()
  cstIpiSaida?: string;

  // ICMS — Regime Normal
  @IsOptional()
  @IsString()
  cstIcms?: string;

  @IsOptional()
  @IsNumber()
  reducaoBcIcms?: number;

  // ICMS — Simples Nacional
  @IsOptional()
  @IsString()
  csosn?: string;

  // PIS / COFINS
  @IsOptional()
  @IsString()
  cstPisCofinsSaida?: string;

  @IsOptional()
  @IsString()
  cstPisCofinsEntrada?: string;

  @IsOptional()
  @IsNumber()
  aliquotaPis?: number;

  @IsOptional()
  @IsNumber()
  aliquotaCofins?: number;

  @IsOptional()
  @IsBoolean()
  monofasico?: boolean;

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

  // Reforma Tributária — CBS
  @IsOptional()
  @IsNumber()
  aliquotaCbs?: number;

  @IsOptional()
  @IsString()
  cstCbs?: string;

  // Reforma Tributária — IBS
  @IsOptional()
  @IsNumber()
  aliquotaIbs?: number;

  @IsOptional()
  @IsString()
  cstIbs?: string;

  // Reforma Tributária — IS
  @IsOptional()
  @IsBoolean()
  temIs?: boolean;

  @IsOptional()
  @IsNumber()
  aliquotaIs?: number;

  @IsOptional()
  @IsString()
  categoriaIs?: string;

  // Reforma geral
  @IsOptional()
  @IsString()
  categoriaReforma?: string;

  @IsOptional()
  @IsString()
  regimeEspecialReforma?: string;

  // Geral
  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
