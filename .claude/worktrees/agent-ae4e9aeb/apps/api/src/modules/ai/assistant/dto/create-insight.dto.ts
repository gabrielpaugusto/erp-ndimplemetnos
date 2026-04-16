import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateInsightDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  category: string; // financeiro, estoque, producao, fiscal

  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  severity: string; // info, warning, critical

  @IsOptional()
  @IsBoolean()
  actionable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  actionUrl?: string;
}
