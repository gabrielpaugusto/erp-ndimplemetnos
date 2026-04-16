import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsEnum,
  MinLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CteModalidadeDto {
  RODOVIARIO    = 'RODOVIARIO',
  AEREO         = 'AEREO',
  AQUAVIARIO    = 'AQUAVIARIO',
  FERROVIARIO   = 'FERROVIARIO',
  DUTOVIARIO    = 'DUTOVIARIO',
  MULTIMODAL    = 'MULTIMODAL',
}

export class CreateCteDto {
  // Identificação
  @IsOptional() @IsString() chaveAcesso?: string;
  @IsString() @MinLength(1) numero: string;
  @IsOptional() @IsString() serie?: string;
  @IsDateString() dataEmissao: string;
  @IsOptional() @IsDateString() dataEntrega?: string;

  // Transportadora
  @IsOptional() @IsString() transportadoraId?: string;
  @IsString() transportadoraCnpj: string;
  @IsString() transportadoraNome: string;

  // Remetente / destinatário do transporte
  @IsOptional() @IsString() remetenteCnpj?: string;
  @IsOptional() @IsString() remetenteNome?: string;
  @IsOptional() @IsString() destinatarioCnpj?: string;
  @IsOptional() @IsString() destinatarioNome?: string;

  // Dados do transporte
  @IsOptional() @IsEnum(CteModalidadeDto) modalidade?: CteModalidadeDto;
  @IsOptional() @IsString() naturezaPrestacao?: string;
  @IsOptional() @IsString() cfop?: string;
  @IsOptional() @IsString() ufInicio?: string;
  @IsOptional() @IsString() ufFim?: string;
  @IsOptional() @IsNumber() pesoTotalKg?: number;

  // Valores
  @IsNumber() @Min(0) @Type(() => Number) valorFrete: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) valorSeguro?: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) valorOutrasDespesas?: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) valorDesconto?: number;

  // ICMS
  @IsOptional() @IsString() cstIcms?: string;
  @IsOptional() @IsNumber() @Type(() => Number) bcIcms?: number;
  @IsOptional() @IsNumber() @Type(() => Number) aliqIcms?: number;
  @IsOptional() @IsNumber() @Type(() => Number) valorIcms?: number;
  @IsOptional() @IsBoolean() creditoIcms?: boolean;

  // Pagamento
  @IsOptional() @IsString() condicaoPagamento?: string;
  @IsOptional() @IsDateString() dataVencimentoFrete?: string;

  // Vínculos
  @IsOptional() @IsString() purchaseOrderId?: string;
  @IsOptional() @IsString() nfeInboxId?: string;

  // Observações
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsString() xmlContent?: string;
}
