import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ApproveRequisitionItemDto {
  @IsString()
  id: string;

  @IsNumber()
  @Min(0)
  quantityApproved: number;
}

export class ApproveRequisitionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApproveRequisitionItemDto)
  items: ApproveRequisitionItemDto[];
}
