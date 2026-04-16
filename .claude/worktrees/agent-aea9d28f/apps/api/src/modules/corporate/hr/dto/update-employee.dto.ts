import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';

export enum EmployeeStatusEnum {
  ATIVO = 'ATIVO',
  FERIAS = 'FERIAS',
  AFASTADO = 'AFASTADO',
  DEMITIDO = 'DEMITIDO',
  APOSENTADO = 'APOSENTADO',
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @IsOptional()
  @IsEnum(EmployeeStatusEnum)
  status?: EmployeeStatusEnum;

  @IsOptional()
  @IsDateString()
  dataDemissao?: string;
}
