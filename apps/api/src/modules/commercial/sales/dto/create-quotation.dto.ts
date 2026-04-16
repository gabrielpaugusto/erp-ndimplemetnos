import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateQuotationItemDto } from './create-quotation-item.dto';
import { SaleTypeEnum } from './sale-type.enum';

export { SaleTypeEnum };

export class CreateQuotationDto {
  @IsString()
  personId: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsEnum(SaleTypeEnum)
  saleType?: SaleTypeEnum;

  @IsOptional()
  @IsString()
  condicaoPagamento?: string;

  @IsOptional()
  @IsDateString()
  validadeOrcamento?: string;

  @IsOptional()
  @IsString()
  prazoEntrega?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsString()
  vendedorId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  comissaoPercent?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items?: CreateQuotationItemDto[];
}
