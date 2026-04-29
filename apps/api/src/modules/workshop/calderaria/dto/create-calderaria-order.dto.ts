import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';

export enum CalderariaServiceType {
  CORTE = 'CORTE',
  DOBRA = 'DOBRA',
  SOLDA = 'SOLDA',
  CONFORMACAO = 'CONFORMACAO',
  USINAGEM = 'USINAGEM',
  TRATAMENTO_TERMICO = 'TRATAMENTO_TERMICO',
  JATEAMENTO = 'JATEAMENTO',
  MONTAGEM_ESTRUTURAL = 'MONTAGEM_ESTRUTURAL',
}

export enum CalderariaModo {
  SERVICO_INTERNO   = 'SERVICO_INTERNO',
  INSTALACAO        = 'INSTALACAO',
  FABRICACAO_AVULSA = 'FABRICACAO_AVULSA',
}

export enum ResultadoTipo {
  ITEM    = 'ITEM',
  SERVICO = 'SERVICO',
}

export class CreateCalderariaOrderDto {
  @IsOptional()
  @IsString()
  serviceOrderId?: string;

  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsEnum(CalderariaServiceType)
  serviceType: CalderariaServiceType;

  @IsOptional()
  @IsEnum(CalderariaModo)
  modo?: CalderariaModo;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  materialDescription?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tempoEstimado?: number;

  @IsOptional()
  @IsString()
  especificacoesTecnicas?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  // ── Fabricação Avulsa ────────────────────────────────────────────────────
  @IsOptional()
  @IsEnum(ResultadoTipo)
  resultadoTipo?: ResultadoTipo;

  @IsOptional()
  @IsString()
  resultadoNome?: string;

  @IsOptional()
  @IsString()
  resultadoNcm?: string;

  @IsOptional()
  @IsString()
  resultadoCodigoServico?: string;

  @IsOptional()
  @IsString()
  resultadoUnidade?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  resultadoQtd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorVenda?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  margemPercentual?: number;
}
