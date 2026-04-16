import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RoutingStepDto {
  @IsInt()
  @Min(1)
  stepNumber: number;

  @IsString()
  workCenterId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  tempoSetup: number;

  @IsNumber()
  @Min(0)
  tempoExecucao: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tempoEspera?: number;
}

export class CreateRoutingDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutingStepDto)
  steps: RoutingStepDto[];
}
