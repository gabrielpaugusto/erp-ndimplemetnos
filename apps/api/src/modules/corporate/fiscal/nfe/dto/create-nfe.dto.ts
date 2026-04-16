import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum NfeTypeDto {
  ENTRADA = 'ENTRADA',
  SAIDA = 'SAIDA',
}

export enum NfeFinalityDto {
  NORMAL = 'NORMAL',
  COMPLEMENTAR = 'COMPLEMENTAR',
  AJUSTE = 'AJUSTE',
  DEVOLUCAO = 'DEVOLUCAO',
}

export enum NfeOperationDto {
  VENDA = 'VENDA',
  COMPRA = 'COMPRA',
  TRANSFERENCIA = 'TRANSFERENCIA',
  DEVOLUCAO_VENDA = 'DEVOLUCAO_VENDA',
  DEVOLUCAO_COMPRA = 'DEVOLUCAO_COMPRA',
  REMESSA = 'REMESSA',
  RETORNO = 'RETORNO',
  BONIFICACAO = 'BONIFICACAO',
  CONSIGNACAO = 'CONSIGNACAO',
  INDUSTRIALIZACAO = 'INDUSTRIALIZACAO',
}

export class CreateNfeItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsString()
  @MaxLength(10)
  ncmCode: string;

  @IsString()
  @MaxLength(4)
  cfopCode: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsString()
  @MaxLength(20)
  unit: string;
}

export class CreateNfeDto {
  @IsEnum(NfeTypeDto)
  type: NfeTypeDto;

  @IsOptional()
  @IsEnum(NfeFinalityDto)
  finality?: NfeFinalityDto;

  @IsEnum(NfeOperationDto)
  operation: NfeOperationDto;

  @IsString()
  personId: string;

  @IsOptional()
  @IsString()
  saleOrderId?: string;

  @IsOptional()
  @IsString()
  serviceOrderId?: string;

  @IsString()
  @MaxLength(200)
  naturezaOperacao: string;

  @IsDateString()
  dataEmissao: string;

  @IsOptional()
  @IsString()
  informacoesComplementares?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateNfeItemDto)
  items: CreateNfeItemDto[];
}
