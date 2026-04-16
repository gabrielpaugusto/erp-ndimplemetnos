import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';

export enum WorkCenterType {
  FABRICACAO = 'FABRICACAO',
  MONTAGEM = 'MONTAGEM',
  PINTURA = 'PINTURA',
  CALDERARIA = 'CALDERARIA',
  ACABAMENTO = 'ACABAMENTO',
  INSPECAO = 'INSPECAO',
}

export class CreateWorkCenterDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsEnum(WorkCenterType)
  type: WorkCenterType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  capacidadeHora: number;

  @IsNumber()
  @Min(0)
  custoHora: number;
}
