import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNfeInboxItemDto {
  @IsNumber()
  numeroItem: number;

  @IsString()
  codigoProdutoFornecedor: string;

  @IsString()
  descricaoProduto: string;

  @IsOptional()
  @IsString()
  ncm?: string;

  @IsOptional()
  @IsString()
  cfop?: string;

  @IsString()
  unidade: string;

  @IsNumber()
  quantidade: number;

  @IsNumber()
  valorUnitario: number;

  @IsNumber()
  valorTotal: number;

  @IsOptional()
  @IsNumber()
  valorIcms?: number;

  @IsOptional()
  @IsNumber()
  valorIpi?: number;

  @IsOptional()
  @IsNumber()
  valorPis?: number;

  @IsOptional()
  @IsNumber()
  valorCofins?: number;
}

export class CreateNfeInboxDto {
  @IsString()
  chaveAcesso: string;

  @IsString()
  numero: string;

  @IsString()
  serie: string;

  @IsString()
  emitenteCnpj: string;

  @IsString()
  emitenteNome: string;

  @IsDateString()
  dataEmissao: string;

  @IsNumber()
  valorTotal: number;

  @IsOptional()
  @IsNumber()
  valorFrete?: number;

  @IsOptional()
  @IsNumber()
  valorSeguro?: number;

  @IsOptional()
  @IsNumber()
  valorOutrasDespesas?: number;

  @IsOptional()
  @IsNumber()
  valorDesconto?: number;

  @IsOptional()
  @IsString()
  xmlContent?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateNfeInboxItemDto)
  items: CreateNfeInboxItemDto[];
}
