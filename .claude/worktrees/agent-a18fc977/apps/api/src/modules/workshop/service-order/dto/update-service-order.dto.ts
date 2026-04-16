import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum, IsString, IsNumber, IsDateString, Min } from 'class-validator';
import { CreateServiceOrderDto } from './create-service-order.dto';

export enum ServiceOrderStatus {
  ABERTA = 'ABERTA',
  AGUARDANDO_PECAS = 'AGUARDANDO_PECAS',
  EM_EXECUCAO = 'EM_EXECUCAO',
  AGUARDANDO_APROVACAO = 'AGUARDANDO_APROVACAO',
  CONCLUIDA = 'CONCLUIDA',
  ENTREGUE = 'ENTREGUE',
  CANCELADA = 'CANCELADA',
}

export class UpdateServiceOrderDto extends PartialType(CreateServiceOrderDto) {
  @IsOptional()
  @IsEnum(ServiceOrderStatus)
  status?: ServiceOrderStatus;

  @IsOptional()
  @IsString()
  diagnostico?: string;

  @IsOptional()
  @IsString()
  solucao?: string;

  @IsOptional()
  @IsDateString()
  dataConclusao?: string;

  @IsOptional()
  @IsDateString()
  dataEntrega?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorPecas?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorMaoDeObra?: number;
}
