import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsDateString,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum JournalItemTypeEnum {
  DEVEDORA = 'DEVEDORA',
  CREDORA = 'CREDORA',
}

export class JournalEntryItemDto {
  @IsString()
  accountId: string;

  @IsEnum(JournalItemTypeEnum)
  type: JournalItemTypeEnum;

  @IsNumber()
  @Min(0.01)
  value: number;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJournalEntryDto {
  @IsDateString()
  date: string;

  @IsString()
  description: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalEntryItemDto)
  items: JournalEntryItemDto[];
}
