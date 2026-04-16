import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { CreateProductionOrderDto } from './create-production-order.dto';

export enum ProductionOrderStatus {
  PLANEJADA = 'PLANEJADA',
  LIBERADA = 'LIBERADA',
  EM_PRODUCAO = 'EM_PRODUCAO',
  PAUSADA = 'PAUSADA',
  CONCLUIDA = 'CONCLUIDA',
  CANCELADA = 'CANCELADA',
}

export class UpdateProductionOrderDto extends PartialType(
  CreateProductionOrderDto,
) {
  @IsOptional()
  @IsEnum(ProductionOrderStatus)
  status?: ProductionOrderStatus;
}
