import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum, IsString, IsNumber, IsDateString, Min } from 'class-validator';
import { CreateCalderariaOrderDto } from './create-calderaria-order.dto';

export enum CalderariaOrderStatus {
  ABERTA = 'ABERTA',
  AGUARDANDO_PECAS = 'AGUARDANDO_PECAS',
  EM_EXECUCAO = 'EM_EXECUCAO',
  AGUARDANDO_APROVACAO = 'AGUARDANDO_APROVACAO',
  CONCLUIDA = 'CONCLUIDA',
  ENTREGUE = 'ENTREGUE',
  CANCELADA = 'CANCELADA',
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
