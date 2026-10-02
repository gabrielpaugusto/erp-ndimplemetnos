import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum, IsString, IsNumber, IsDateString, Min } from 'class-validator';
import { CreateCalderariaOrderDto } from './create-calderaria-order.dto';

export enum CalderariaOrderStatus {
  ABERTA              = 'ABERTA',
  EM_EXECUCAO         = 'EM_EXECUCAO',
  AGUARDANDO_MATERIAL = 'AGUARDANDO_MATERIAL',
  CONCLUIDA           = 'CONCLUIDA',
  CANCELADA           = 'CANCELADA',
}

export class UpdateCalderariaOrderDto extends PartialType(CreateCalderariaOrderDto) {
  @IsOptional()
  @IsEnum(CalderariaOrderStatus)
  status?: CalderariaOrderStatus;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tempoReal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorCustoReal?: number;

  @IsOptional()
  @IsString()
  responsavelId?: string;
}
