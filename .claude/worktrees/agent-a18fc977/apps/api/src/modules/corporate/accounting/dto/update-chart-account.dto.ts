import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsBoolean } from 'class-validator';
import { CreateChartAccountDto } from './create-chart-account.dto';

export class UpdateChartAccountDto extends PartialType(CreateChartAccountDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
