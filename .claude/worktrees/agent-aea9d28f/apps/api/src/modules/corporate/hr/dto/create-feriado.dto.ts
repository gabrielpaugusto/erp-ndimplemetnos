import { IsString, IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum FeriadoTipo {
  FERIADO = 'FERIADO',
  FERIAS_COLETIVAS = 'FERIAS_COLETIVAS',
  PONTO_FACULTATIVO = 'PONTO_FACULTATIVO',
}

export class CreateFeriadoDto {
  @IsDateString()
  data: string;

  @IsString()
  descricao: string;

  @IsEnum(FeriadoTipo)
  @IsOptional()
  tipo?: FeriadoTipo;
}
