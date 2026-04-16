import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';

export enum FiscalEntryTypeDto {
  DEBITO = 'DEBITO',
  CREDITO = 'CREDITO',
}

export enum FiscalBookTypeDto {
  ENTRADA = 'ENTRADA',
  SAIDA = 'SAIDA',
  APURACAO_ICMS = 'APURACAO_ICMS',
  APURACAO_IPI = 'APURACAO_IPI',
  APURACAO_PIS = 'APURACAO_PIS',
  APURACAO_COFINS = 'APURACAO_COFINS',
}

export class CreateFiscalEntryDto {
  @IsOptional()
  @IsString()
  nfeId?: string;

  @IsEnum(FiscalEntryTypeDto)
  type: FiscalEntryTypeDto;

  @IsEnum(FiscalBookTypeDto)
  bookType: FiscalBookTypeDto;

  @IsDateString()
  dataLancamento: string;

  @IsString()
  @MaxLength(7)
  periodoReferencia: string;

  @IsString()
  @MaxLength(4)
  cfopCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  naturezaOperacao?: string;

  @IsNumber()
  @Min(0)
  valorContabil: number;

  @IsNumber()
  @Min(0)
  baseCalculo: number;

  @IsNumber()
  @Min(0)
  aliquota: number;

  @IsNumber()
  @Min(0)
  valorImposto: number;

  @IsString()
  @MaxLength(10)
  taxType: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
