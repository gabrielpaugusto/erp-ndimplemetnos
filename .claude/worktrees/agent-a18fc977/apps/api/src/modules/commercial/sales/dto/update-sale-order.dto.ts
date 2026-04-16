import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateSaleOrderDto } from './create-sale-order.dto';

export class UpdateSaleOrderDto extends PartialType(CreateSaleOrderDto) {
  @IsOptional()
  @IsString()
  status?: string;
}
