import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  Min,
} from 'class-validator';

export enum AccountTypeEnum {
  ATIVO = 'ATIVO',
  PASSIVO = 'PASSIVO',
  RECEITA = 'RECEITA',
  DESPESA = 'DESPESA',
  PATRIMONIO_LIQUIDO = 'PATRIMONIO_LIQUIDO',
}

export enum AccountNatureEnum {
  DEVEDORA = 'DEVEDORA',
  CREDORA = 'CREDORA',
}

export class CreateChartAccountDto {
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsEnum(AccountTypeEnum)
  type: AccountTypeEnum;

  @IsEnum(AccountNatureEnum)
  nature: AccountNatureEnum;

  @IsInt()
  @Min(1)
  level: number;

  @IsOptional()
  @IsBoolean()
  acceptsEntries?: boolean;
}
