import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MaxLength(50)
  code: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsOptional()
  @IsString()
  descriptionShort?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  ncmId?: string;

  @IsOptional()
  @IsString()
  cestCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precoCusto?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precoVenda?: number;

  @IsOptional()
  @IsNumber()
  margemLucro?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estoqueMinimo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estoqueMaximo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pesoLiquido?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pesoBruto?: number;

  @IsOptional()
  @IsString()
  costCenterCode?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
