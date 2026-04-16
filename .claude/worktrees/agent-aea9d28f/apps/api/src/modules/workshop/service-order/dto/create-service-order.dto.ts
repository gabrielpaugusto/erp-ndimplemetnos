import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ServiceOrderType {
  MANUTENCAO = 'MANUTENCAO',
  REFORMA = 'REFORMA',
  INSTALACAO = 'INSTALACAO',
  GARANTIA = 'GARANTIA',
  ORCAMENTO = 'ORCAMENTO',
}

export enum ServiceOrderPriority {
  BAIXA = 'BAIXA',
  NORMAL = 'NORMAL',
  ALTA = 'ALTA',
  URGENTE = 'URGENTE',
}

export enum ServiceOrderItemType {
  PECA = 'PECA',
  SERVICO = 'SERVICO',
  TERCEIRO = 'TERCEIRO',
}

export class CreateServiceOrderItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsEnum(ServiceOrderItemType)
  type: ServiceOrderItemType;
}

export class CreateServiceOrderDto {
  @IsString()
  personId: string;

  @IsEnum(ServiceOrderType)
  type: ServiceOrderType;

  @IsOptional()
  @IsEnum(ServiceOrderPriority)
  priority?: ServiceOrderPriority;

  @IsString()
  veiculoDescricao: string;

  @IsOptional()
  @IsString()
  veiculoPlaca?: string;

  @IsOptional()
  @IsString()
  veiculoChassi?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  veiculoKm?: number;

  @IsString()
  defeitoRelatado: string;

  @IsDateString()
  dataEntrada: string;

  @IsOptional()
  @IsDateString()
  dataPrevisao?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateServiceOrderItemDto)
  items?: CreateServiceOrderItemDto[];
}
