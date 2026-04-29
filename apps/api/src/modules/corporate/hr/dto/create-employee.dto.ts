import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';

export enum ApontamentoRoleEnum {
  MECANICO = 'MECANICO',
  OPERADOR = 'OPERADOR',
}

export class CreateEmployeeDto {
  @IsString()
  personId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  matricula: string;

  @IsString()
  cargo: string;

  @IsString()
  departamento: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsDateString()
  dataAdmissao: string;

  @IsNumber()
  @Min(0)
  salarioBase: number;

  @IsOptional()
  @IsString()
  ctps?: string;

  @IsOptional()
  @IsString()
  pis?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  jornadaSemanal?: number;

  @IsOptional()
  @IsEnum(ApontamentoRoleEnum)
  apontamentoRole?: ApontamentoRoleEnum;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorHora?: number;

  @IsOptional()
  @IsString()
  observations?: string;
}
