import { IsString, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { SaleTypeEnum } from './sale-type.enum';

export class CreateQuotationItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsEnum(SaleTypeEnum)
  itemType?: SaleTypeEnum;

  @IsNumber()
  @Min(0.0001)
  quantidade: number;

  @IsNumber()
  @Min(0)
  precoUnitario: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  desconto?: number;

  @IsOptional()
  @IsString()
  descricaoLivre?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
