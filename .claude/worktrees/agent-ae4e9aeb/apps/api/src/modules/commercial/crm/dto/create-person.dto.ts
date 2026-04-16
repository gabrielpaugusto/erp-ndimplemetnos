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

export enum PersonRole {
  CLIENTE = 'CLIENTE',
  FORNECEDOR = 'FORNECEDOR',
  TRANSPORTADORA = 'TRANSPORTADORA',
  FUNCIONARIO = 'FUNCIONARIO',
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
