import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export enum AdiantamentoMovTipoDto {
  CREDITO = 'CREDITO',
  DEBITO = 'DEBITO',
}

export class CreateAdiantamentoMovimentoDto {
  @IsEnum(AdiantamentoMovTipoDto)
  tipo: AdiantamentoMovTipoDto;

  @IsNumber()
  @IsPositive()
  valor: number;

  @IsDateString()
  data: string;

  @IsString()
  @IsNotEmpty()
  descricao: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  referencia?: string;

  @IsString()
  @IsOptional()
  bankAccountId?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  observations?: string;
}
