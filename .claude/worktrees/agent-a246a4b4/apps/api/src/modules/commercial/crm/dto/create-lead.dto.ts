import {
  IsString,
  IsOptional,
  IsNumber,
  MaxLength,
  Min,
  Max,
  IsDateString,
} from 'class-validator';

export class CreateLeadDto {
  @IsOptional()
  @IsString()
  personId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsString()
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorEstimado?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  probabilidade?: number;

  @IsOptional()
  @IsString()
  vendedorId?: string;

  @IsOptional()
  @IsDateString()
  dataPrevisaoFechamento?: string;
}
