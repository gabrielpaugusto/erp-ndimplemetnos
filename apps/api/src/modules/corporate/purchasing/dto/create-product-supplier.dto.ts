import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
} from 'class-validator';

export class CreateProductSupplierDto {
  @IsString()
  productId: string;

  @IsString()
  personId: string;

  @IsString()
  codigoFornecedor: string;

  @IsString()
  descricaoFornecedor: string;

  @IsOptional()
  @IsString()
  unidadeFornecedor?: string;

  @IsOptional()
  @IsNumber()
  fatorConversao?: number;

  @IsOptional()
  @IsNumber()
  precoUltCompra?: number;

  @IsOptional()
  @IsNumber()
  prazoEntregaDias?: number;

  @IsOptional()
  @IsBoolean()
  preferred?: boolean;
}
