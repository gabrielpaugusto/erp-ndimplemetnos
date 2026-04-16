import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { FinancialMovementTypeEnum } from './create-financial-movement.dto';

export class CreateCashFlowDto {
  @IsDateString()
  date: string;

  @IsString()
  description: string;

  @IsEnum(FinancialMovementTypeEnum)
  type: FinancialMovementTypeEnum;

  @IsNumber()
  valorPrevisto: number;

  @IsOptional()
  @IsNumber()
  valorRealizado?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;
}
