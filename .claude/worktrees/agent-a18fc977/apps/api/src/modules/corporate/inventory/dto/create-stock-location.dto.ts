import {
  IsString,
  IsOptional,
  MaxLength,
  IsIn,
} from 'class-validator';

export class CreateStockLocationDto {
  @IsString()
  @MaxLength(50)
  code: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsIn(['ALMOXARIFADO', 'PRODUCAO', 'EXPEDICAO', 'QUARENTENA'])
  type: string;
}
