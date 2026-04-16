import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateNfeDto } from './create-nfe.dto';

export class UpdateNfeDto extends PartialType(CreateNfeDto) {}

export class CancelNfeDto {
  @IsString()
  motivo: string;
}
