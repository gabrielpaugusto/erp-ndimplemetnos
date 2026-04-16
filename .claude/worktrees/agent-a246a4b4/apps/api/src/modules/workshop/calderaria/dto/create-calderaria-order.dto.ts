import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
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

export class CreateCalderariaOrderDto {
  @IsOptional()
  @IsString()
  serviceOrderId?: string;

  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsEnum(CalderariaServiceType)
  serviceType: CalderariaServiceType;

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
}
