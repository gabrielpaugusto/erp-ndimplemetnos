import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';

export enum TaxRuleOperationDto {
  VENDA = 'VENDA',
  COMPRA = 'COMPRA',
  TRANSFERENCIA = 'TRANSFERENCIA',
  DEVOLUCAO_VENDA = 'DEVOLUCAO_VENDA',
  DEVOLUCAO_COMPRA = 'DEVOLUCAO_COMPRA',
  REMESSA = 'REMESSA',
  RETORNO = 'RETORNO',
  BONIFICACAO = 'BONIFICACAO',
  CONSIGNACAO = 'CONSIGNACAO',
  INDUSTRIALIZACAO = 'INDUSTRIALIZACAO',
}

export class CreateTaxRuleDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  ncmCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  cfopCode?: string;

  @IsOptional()
  @IsEnum(TaxRuleOperationDto)
  operation?: TaxRuleOperationDto;

  // ICMS
  @IsOptional()
  @IsString()
  @MaxLength(3)
  cstIcms?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  aliqIcms?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reducaoBcIcms?: number;

  // IPI
  @IsOptional()
  @IsString()
  @MaxLength(2)
  cstIpi?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  aliqIpi?: number;

  // PIS
  @IsOptional()
  @IsString()
  @MaxLength(2)
  cstPis?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  aliqPis?: number;

  // COFINS
  @IsOptional()
  @IsString()
  @MaxLength(2)
  cstCofins?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  aliqCofins?: number;

  // Reforma Tributaria
  @IsOptional()
  @IsNumber()
  @Min(0)
  aliqIbs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  aliqCbs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  aliqIs?: number;

  // Control
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  priority?: number;
}
