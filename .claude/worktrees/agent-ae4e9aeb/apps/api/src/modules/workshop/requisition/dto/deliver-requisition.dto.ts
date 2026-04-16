import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DeliverRequisitionItemDto {
  @IsString()
  id: string;

  @IsNumber()
  @Min(0)
  quantityDelivered: number;
}

export class DeliverRequisitionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliverRequisitionItemDto)
  items: DeliverRequisitionItemDto[];
}
