import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum PayrollTypeEnum {
  MENSAL = 'MENSAL',
  FERIAS = 'FERIAS',
  DECIMO_TERCEIRO = 'DECIMO_TERCEIRO',
  RESCISAO = 'RESCISAO',
  ADIANTAMENTO = 'ADIANTAMENTO',
}

export class CreatePayrollDto {
  @IsString()
  periodoReferencia: string;

  @IsOptional()
  @IsEnum(PayrollTypeEnum)
  type?: PayrollTypeEnum;

  @IsOptional()
  @IsString()
  observations?: string;
}
