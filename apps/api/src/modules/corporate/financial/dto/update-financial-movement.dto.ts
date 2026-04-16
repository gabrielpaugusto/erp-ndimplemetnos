import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateFinancialMovementDto } from './create-financial-movement.dto';

export enum FinancialMovementStatusEnum {
  PENDENTE = 'PENDENTE',
  VENCIDO = 'VENCIDO',
  PAGO = 'PAGO',
  CANCELADO = 'CANCELADO',
  RENEGOCIADO = 'RENEGOCIADO',
}

export class UpdateFinancialMovementDto extends PartialType(
  CreateFinancialMovementDto,
) {
  @IsOptional()
  @IsEnum(FinancialMovementStatusEnum)
  status?: FinancialMovementStatusEnum;
}
