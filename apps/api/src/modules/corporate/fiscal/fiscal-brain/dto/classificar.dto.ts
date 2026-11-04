import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContextoOperacao } from '../classificador.service';

class ProdutoDto {
  @IsString() @IsNotEmpty() ncm: string;
  @IsString() @IsNotEmpty() descricao: string;
  @IsNumber() valor: number;
  @IsNumber() quantidade: number;
  @IsString() @IsNotEmpty() unit: string;
}

class ContextoOperacaoDto implements ContextoOperacao {
  @IsString() @IsNotEmpty() cnaeEmitente: string;
  @IsIn(['SN', 'LP', 'LR']) regimeTributario: 'SN' | 'LP' | 'LR';
  @IsString() @IsNotEmpty() ufEmitente: string;
  @IsBoolean() isIndustrial: boolean;

  @IsString() @IsNotEmpty() ufDestinatario: string;
  @IsBoolean() isContribuinte: boolean;
  @IsBoolean() isConsumidorFinal: boolean;
  @IsOptional() @IsString() cnaeDestinatario?: string;
  @IsOptional() @IsString() ramoAtividadeFornecedor?: string;
  @IsOptional() @IsString() naturezaJuridicaFornecedor?: string;
  @IsOptional() @IsString() taxRegimeFornecedor?: string;

  @IsIn(['SAIDA', 'ENTRADA']) tipoOperacao: 'SAIDA' | 'ENTRADA';
  @IsString() @IsNotEmpty() naturezaOperacao: string;

  @ValidateNested({ each: true })
  @Type(() => ProdutoDto)
  @ArrayMinSize(1)
  produtos: ProdutoDto[];

  @IsOptional()
  @IsIn(['REVENDA', 'INDUSTRIALIZACAO', 'USO_CONSUMO', 'ATIVO_IMOBILIZADO'])
  finalidadeDestinatario?: 'REVENDA' | 'INDUSTRIALIZACAO' | 'USO_CONSUMO' | 'ATIVO_IMOBILIZADO';

  @IsOptional() @IsBoolean() temProtocoloST?: boolean;

  @IsOptional()
  @IsIn(['INDUSTRIALIZACAO', 'REVENDA', 'USO_CONSUMO'])
  destinacaoEntradaCST60?: 'INDUSTRIALIZACAO' | 'REVENDA' | 'USO_CONSUMO';

  @IsOptional() operacoesSimilares?: { cfop: string; natureza: string; confianca: number }[];
  @IsOptional() dataEmissao?: Date;
  @IsOptional() @IsBoolean() regime2027?: boolean;
}

export class ClassificarDto {
  @IsString() @IsNotEmpty() documentType: string;
  @IsString() @IsNotEmpty() documentId: string;

  @ValidateNested()
  @Type(() => ContextoOperacaoDto)
  contexto: ContextoOperacaoDto;
}
