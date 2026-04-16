import {
  IsEnum,
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  MinLength,
} from 'class-validator';

export enum ECOType {
  BOM = 'BOM',
  ROTEIRO = 'ROTEIRO',
  ESPECIFICACAO = 'ESPECIFICACAO',
  SUBSTITUCAO_MATERIAL = 'SUBSTITUCAO_MATERIAL',
}

export class DocumentoAfetadoDto {
  @IsString()
  type: string; // "ProductionOrder" | "ServiceOrder" | "SaleOrder"

  @IsString()
  id: string;

  @IsString()
  numero: string;
}

export class CreateEcoDto {
  @IsEnum(ECOType)
  tipo: ECOType;

  @IsString()
  @MinLength(10)
  descricao: string;

  @IsString()
  @MinLength(10)
  motivoTecnico: string;

  @IsBoolean()
  @IsOptional()
  impactoEstoque?: boolean;

  @IsBoolean()
  @IsOptional()
  impactoCusto?: boolean;

  @IsArray()
  @IsOptional()
  documentosAfetados?: DocumentoAfetadoDto[];
}

export class UpdateEcoStatusDto {
  @IsEnum(['APROVADO', 'IMPLEMENTADO', 'CANCELADO'])
  status: 'APROVADO' | 'IMPLEMENTADO' | 'CANCELADO';
}
