import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  IsBoolean,
  MaxLength,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

export enum PersonType {
  PF = 'PF',
  PJ = 'PJ',
}

export enum TaxRegime {
  LUCRO_REAL = 'LUCRO_REAL',
  LUCRO_PRESUMIDO = 'LUCRO_PRESUMIDO',
  SIMPLES_NACIONAL = 'SIMPLES_NACIONAL',
  // MEI removido: MEI é Natureza Jurídica. Fiscalmente tratado como SIMPLES_NACIONAL.
}

/** @deprecated Use RamoAtividadeEnum. Mantido para compatibilidade com regras customizadas. */
export enum TipoFornecedorEnum {
  INDUSTRIA = 'INDUSTRIA',
  ATACADISTA_EQUIPARADO = 'ATACADISTA_EQUIPARADO',
  COMERCIO = 'COMERCIO',
  SIMPLES_NACIONAL = 'SIMPLES_NACIONAL',
  MEI = 'MEI',
  IMPORTADOR = 'IMPORTADOR',
  PESSOA_FISICA = 'PESSOA_FISICA',
}

/** Ramo de atividade do fornecedor — substitui TipoFornecedorEnum (Fase 2) */
export enum RamoAtividadeEnum {
  INDUSTRIA = 'INDUSTRIA',
  ATACADISTA_EQUIPARADO = 'ATACADISTA_EQUIPARADO',
  COMERCIO = 'COMERCIO',
  PRESTADOR_SERVICO = 'PRESTADOR_SERVICO',
  IMPORTADOR = 'IMPORTADOR',
  PESSOA_FISICA = 'PESSOA_FISICA',
}

export enum PersonRole {
  CLIENTE = 'CLIENTE',
  FORNECEDOR = 'FORNECEDOR',
  TRANSPORTADORA = 'TRANSPORTADORA',
  FUNCIONARIO = 'FUNCIONARIO',
  PRESTADOR = 'PRESTADOR',
  REPRESENTANTE = 'REPRESENTANTE',
  VENDEDOR = 'VENDEDOR',
  OUTROS = 'OUTROS',
}

export class CreateAddressDto {
  @IsString()
  type: string;

  @IsString()
  logradouro: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsString()
  complemento?: string;

  @IsOptional()
  @IsString()
  bairro?: string;

  @IsOptional()
  @IsString()
  codigoMunicipioIbge?: string;

  @IsOptional()
  @IsString()
  municipio?: string;

  @IsOptional()
  @IsString()
  uf?: string;

  @IsOptional()
  @IsString()
  cep?: string;

  @IsBoolean()
  principal: boolean;
}

export class CreateContactDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsBoolean()
  principal: boolean;
}

export class CreatePersonDto {
  @IsEnum(PersonType)
  type: string;

  @IsOptional()
  @IsString()
  @Length(0, 18)
  cpfCnpj?: string;

  @IsString()
  @MaxLength(200)
  razaoSocial: string;

  @IsOptional()
  @IsString()
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  rgIe?: string;

  @IsArray()
  @IsEnum(PersonRole, { each: true })
  roles: string[];

  @IsOptional()
  @IsString()
  inscricaoMunicipal?: string;

  @IsOptional()
  @IsString()
  cnaePrincipal?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  limiteCredito?: number;

  @IsOptional()
  @IsString()
  condicaoPagamento?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsEnum(TaxRegime)
  taxRegime?: TaxRegime;

  /** @deprecated Use ramoAtividadeId. Mantido para compatibilidade. */
  @IsOptional()
  @IsEnum(TipoFornecedorEnum)
  tipoFornecedor?: TipoFornecedorEnum;

  /** Natureza Jurídica (FK para tabela naturezas_juridicas — gerenciável via ERP) */
  @IsOptional()
  @IsString()
  naturezaJuridicaId?: string;

  /** Ramo de Atividade (FK para tabela ramos_atividade — substitui tipoFornecedor) */
  @IsOptional()
  @IsString()
  ramoAtividadeId?: string;

  @IsOptional()
  @IsBoolean()
  optanteSimples?: boolean;

  @IsOptional()
  @IsBoolean()
  retencaoIss?: boolean;

  @IsOptional()
  @IsBoolean()
  retencaoFederal?: boolean;

  @IsOptional()
  @IsBoolean()
  retencaoInss?: boolean;

  @IsOptional()
  @IsString()
  municipioIbge?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAddressDto)
  addresses?: CreateAddressDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContactDto)
  contacts?: CreateContactDto[];
}
