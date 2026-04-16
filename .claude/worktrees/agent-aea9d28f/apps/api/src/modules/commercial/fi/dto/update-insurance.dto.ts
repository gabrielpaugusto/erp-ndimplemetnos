import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { CreateInsuranceDto } from './create-insurance.dto';

export enum InsuranceStatusEnum {
  COTACAO = 'COTACAO',
  PROPOSTA = 'PROPOSTA',
  VIGENTE = 'VIGENTE',
  VENCIDO = 'VENCIDO',
  SINISTRO = 'SINISTRO',
  CANCELADO = 'CANCELADO',
}

export class UpdateInsuranceDto extends PartialType(CreateInsuranceDto) {
  @IsOptional()
  @IsEnum(InsuranceStatusEnum)
  status?: InsuranceStatusEnum;

  @IsOptional()
  @IsString()
  numeroApolice?: string;

  @IsOptional()
  @IsString()
  numeroProposta?: string;

  @IsOptional()
  @IsDateString()
  dataRenovacao?: string;
}
