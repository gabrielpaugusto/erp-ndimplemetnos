import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ManifestacaoType {
  CIENCIA_OPERACAO = 'CIENCIA_OPERACAO',
  CONFIRMACAO_OPERACAO = 'CONFIRMACAO_OPERACAO',
  DESCONHECIMENTO_OPERACAO = 'DESCONHECIMENTO_OPERACAO',
  OPERACAO_NAO_REALIZADA = 'OPERACAO_NAO_REALIZADA',
}

export class ManifestNfeDto {
  @IsEnum(ManifestacaoType)
  manifestacao: ManifestacaoType;

  @IsOptional()
  @IsString()
  justificativa?: string;
}
