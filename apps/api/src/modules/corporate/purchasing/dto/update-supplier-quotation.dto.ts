import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierQuotationDto } from './create-supplier-quotation.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateSupplierQuotationDto extends PartialType(CreateSupplierQuotationDto) {
  @IsOptional()
  @IsString()
  status?: string;
}
