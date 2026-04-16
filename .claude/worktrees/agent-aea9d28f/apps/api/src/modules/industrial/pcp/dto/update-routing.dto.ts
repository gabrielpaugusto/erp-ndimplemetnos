import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateRoutingDto, RoutingStepDto } from './create-routing.dto';

export class UpdateRoutingDto extends PartialType(CreateRoutingDto) {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutingStepDto)
  steps?: RoutingStepDto[];
}
