import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBomDto, BomItemDto } from './create-bom.dto';

export class UpdateBomDto extends PartialType(CreateBomDto) {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BomItemDto)
  items?: BomItemDto[];
}
