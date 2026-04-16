import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { CreateFinancingDto } from './create-financing.dto';

export enum FinancingStatusEnum {
  SIMULACAO = 'SIMULACAO',
  PROPOSTA_ENVIADA = 'PROPOSTA_ENVIADA',
  EM_ANALISE = 'EM_ANALISE',
  APROVADO = 'APROVADO',
  CONTRATADO = 'CONTRATADO',
  LIBERADO = 'LIBERADO',
  RECUSADO = 'RECUSADO',
  CANCELADO = 'CANCELADO',
}

export class UpdateFinancingDto extends PartialType(CreateFinancingDto) {
  @IsOptional()
  @IsEnum(FinancingStatusEnum)
  status?: FinancingStatusEnum;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsDateString()
  dataSimulacao?: string;

  @IsOptional()
  @IsDateString()
  dataProposta?: string;

  @IsOptional()
  @IsDateString()
  dataAprovacao?: string;

  @IsOptional()
  @IsDateString()
  dataContratacao?: string;

  @IsOptional()
  @IsDateString()
  dataLiberacao?: string;
}
