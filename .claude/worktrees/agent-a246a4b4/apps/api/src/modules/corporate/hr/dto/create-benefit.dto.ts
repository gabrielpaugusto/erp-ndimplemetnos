import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';

export enum BenefitTypeEnum {
  VALE_TRANSPORTE = 'VALE_TRANSPORTE',
  VALE_REFEICAO = 'VALE_REFEICAO',
  VALE_ALIMENTACAO = 'VALE_ALIMENTACAO',
  PLANO_SAUDE = 'PLANO_SAUDE',
  PLANO_ODONTOLOGICO = 'PLANO_ODONTOLOGICO',
  SEGURO_VIDA = 'SEGURO_VIDA',
  CESTA_BASICA = 'CESTA_BASICA',
}

export class CreateBenefitDto {
  @IsString()
  employeeId: string;

  @IsEnum(BenefitTypeEnum)
  type: BenefitTypeEnum;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  valorEmpresa: number;

  @IsNumber()
  @Min(0)
  valorFuncionario: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
