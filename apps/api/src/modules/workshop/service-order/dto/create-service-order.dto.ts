import {
  IsString, IsOptional, IsEnum, IsNumber, IsInt, IsBoolean,
  IsDateString, IsArray, ValidateNested, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ServiceOrderType {
  MECANICA = 'MECANICA',
  CALDERARIA = 'CALDERARIA',
  PINTURA = 'PINTURA',
  MISTA = 'MISTA',
  GARANTIA = 'GARANTIA',
  INSTALACAO = 'INSTALACAO',
  INTERNA = 'INTERNA',
}

export enum ServiceOrderPriority {
  BAIXA = 'BAIXA',
  NORMAL = 'NORMAL',
  ALTA = 'ALTA',
  URGENTE = 'URGENTE',
}

export enum TipoPagadorOS {
  CLIENTE = 'CLIENTE',
  FABRICA = 'FABRICA',
  SEGURADORA = 'SEGURADORA',
  TERCEIRO = 'TERCEIRO',
  PROPRIA = 'PROPRIA',
}

export enum OsItemTipo {
  PECA = 'PECA',
  SERVICO = 'SERVICO',
  MATERIAL_CALDERARIA = 'MATERIAL_CALDERARIA',
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

  @IsOptional()
  @IsEnum(OsItemTipo)
  tipo?: OsItemTipo;

  // Custo de instalação
  @IsOptional()
  @IsBoolean()
  agregaCustoCarroceria?: boolean;

  @IsOptional()
  @IsBoolean()
  faturavel?: boolean;

  @IsOptional()
  @IsBoolean()
  incluidoNoProduto?: boolean;
}

export class CreateServiceOrderDto {
  @IsString()
  personId: string;

  @IsEnum(ServiceOrderType)
  type: ServiceOrderType;

  @IsOptional()
  @IsEnum(ServiceOrderPriority)
  priority?: ServiceOrderPriority;

  @IsOptional()
  @IsEnum(TipoPagadorOS)
  tipoPagador?: TipoPagadorOS;

  // Equipamento (substitui campos texto livres)
  @IsOptional()
  @IsString()
  equipamentoId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  kmEntrada?: number;

  // OS de instalação — carroceria sendo instalada
  @IsOptional()
  @IsString()
  carroceriaId?: string;

  // Garantia / Fabricante
  @IsOptional()
  @IsString()
  garantiaFabricante?: string;

  @IsOptional()
  @IsBoolean()
  garantiaReembolsaPecas?: boolean;

  @IsOptional()
  @IsBoolean()
  garantiaReembolsaMO?: boolean;

  @IsOptional()
  @IsString()
  fabricantePersonId?: string; // Person PJ — fabricante para reembolso

  // Seguradora
  @IsOptional()
  @IsString()
  seguradoraId?: string; // Person PJ — seguradora

  @IsOptional()
  @IsString()
  apoliceNumero?: string;

  @IsOptional()
  @IsString()
  sinistroNumero?: string;

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
