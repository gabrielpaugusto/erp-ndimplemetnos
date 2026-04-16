import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateConsortiumDto } from './create-consortium.dto';

export enum ConsortiumStatusEnum {
  ATIVO = 'ATIVO',
  CONTEMPLADO = 'CONTEMPLADO',
  ENCERRADO = 'ENCERRADO',
  CANCELADO = 'CANCELADO',
  TRANSFERIDO = 'TRANSFERIDO',
}

export class UpdateConsortiumDto extends PartialType(CreateConsortiumDto) {
  @IsOptional()
  @IsEnum(ConsortiumStatusEnum)
  status?: ConsortiumStatusEnum;
}
