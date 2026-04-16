import { IsString, IsOptional, IsBoolean, IsInt, IsIn, MinLength, MaxLength } from 'class-validator';

const DESTINACOES = [
  'MATERIA_PRIMA','COMPONENTE','PRODUTO_REVENDA','INSUMO_PRODUCAO','EMBALAGEM',
  'MATERIAL_USO_CONSUMO','GGF','IMOBILIZADO','SERVICO','FRETE','SERVICO_TOMADO',
  'PRODUTO_INDUSTRIALIZADO','SERVICO_EMITIDO','DEVOLUCAO_COMPRA',
];
const TIPOS_FORN  = ['INDUSTRIA','ATACADISTA_EQUIPARADO','COMERCIO','SIMPLES_NACIONAL','MEI','IMPORTADOR','PESSOA_FISICA'];
const TIPOS_CLI   = ['CONTRIBUINTE','CONTRIBUINTE_SIMPLES','NAO_CONTRIBUINTE'];
const TIPOS_OP    = ['ENTRADA','SAIDA'];
const REGIMES     = ['LUCRO_REAL','LUCRO_PRESUMIDO','SIMPLES_NACIONAL','MEI'];
const FINALIDADES = ['VENDA','REMESSA','DEVOLUCAO','INDUSTRIALIZACAO','TRANSFERENCIA'];

export class CreateOperacaoFiscalDto {
  @IsString() @MinLength(3) @MaxLength(30)
  codigo: string;

  @IsString() @MinLength(5) @MaxLength(200)
  descricao: string;

  @IsString() @IsIn(TIPOS_OP)
  tipo: string;

  @IsOptional() @IsString() @IsIn(DESTINACOES)
  destinacao?: string;

  @IsOptional() @IsString() @IsIn(TIPOS_FORN)
  tipoFornecedor?: string;

  @IsOptional() @IsString() @IsIn(TIPOS_CLI)
  tipoCliente?: string;

  @IsOptional() @IsBoolean()
  intraestadual?: boolean;

  @IsOptional() @IsBoolean()
  temST?: boolean;

  @IsOptional() @IsBoolean()
  stRetida?: boolean;

  @IsOptional() @IsBoolean()
  freteContaDestinatario?: boolean;

  @IsOptional() @IsString() @IsIn(FINALIDADES)
  finalidade?: string;

  @IsOptional() @IsString() @IsIn(REGIMES)
  regimeTributario?: string;

  @IsInt()
  prioridade: number;

  @IsString() @MaxLength(4)
  cfop: string;

  @IsString() @MaxLength(3)
  cstIcms: string;

  @IsString() @MaxLength(2)
  cstIpi: string;

  @IsString() @MaxLength(2)
  cstPis: string;

  @IsString() @MaxLength(2)
  cstCofins: string;

  @IsBoolean()
  creditaIcms: boolean;

  @IsBoolean()
  creditaIpi: boolean;

  @IsBoolean()
  creditaPisCofins: boolean;

  @IsBoolean()
  icmsSimplesPCredSN: boolean;

  @IsBoolean()
  ciap: boolean;

  @IsBoolean()
  pisCofins24x: boolean;

  @IsBoolean()
  retencaoIss: boolean;

  @IsBoolean()
  retencaoFederal: boolean;

  @IsBoolean()
  retencaoInss: boolean;

  @IsOptional() @IsString() @MaxLength(20)
  contaDebitoCode?: string;

  @IsOptional() @IsBoolean()
  ativo?: boolean;
}

export class UpdateOperacaoFiscalDto {
  @IsOptional() @IsString() @MinLength(5) @MaxLength(200)
  descricao?: string;

  @IsOptional() @IsString() @IsIn(DESTINACOES)
  destinacao?: string;

  @IsOptional() @IsString() @IsIn(TIPOS_FORN)
  tipoFornecedor?: string;

  @IsOptional() @IsString() @IsIn(TIPOS_CLI)
  tipoCliente?: string;

  @IsOptional() @IsBoolean()
  intraestadual?: boolean;

  @IsOptional() @IsBoolean()
  temST?: boolean;

  @IsOptional() @IsBoolean()
  stRetida?: boolean;

  @IsOptional() @IsBoolean()
  freteContaDestinatario?: boolean;

  @IsOptional() @IsString() @IsIn(FINALIDADES)
  finalidade?: string;

  @IsOptional() @IsString() @IsIn(REGIMES)
  regimeTributario?: string;

  @IsOptional() @IsInt()
  prioridade?: number;

  @IsOptional() @IsString() @MaxLength(4)
  cfop?: string;

  @IsOptional() @IsString() @MaxLength(3)
  cstIcms?: string;

  @IsOptional() @IsString() @MaxLength(2)
  cstIpi?: string;

  @IsOptional() @IsString() @MaxLength(2)
  cstPis?: string;

  @IsOptional() @IsString() @MaxLength(2)
  cstCofins?: string;

  @IsOptional() @IsBoolean()
  creditaIcms?: boolean;

  @IsOptional() @IsBoolean()
  creditaIpi?: boolean;

  @IsOptional() @IsBoolean()
  creditaPisCofins?: boolean;

  @IsOptional() @IsBoolean()
  icmsSimplesPCredSN?: boolean;

  @IsOptional() @IsBoolean()
  ciap?: boolean;

  @IsOptional() @IsBoolean()
  pisCofins24x?: boolean;

  @IsOptional() @IsBoolean()
  retencaoIss?: boolean;

  @IsOptional() @IsBoolean()
  retencaoFederal?: boolean;

  @IsOptional() @IsBoolean()
  retencaoInss?: boolean;

  @IsOptional() @IsString() @MaxLength(20)
  contaDebitoCode?: string;

  @IsOptional() @IsBoolean()
  ativo?: boolean;
}

export class DeterminarOperacaoDto {
  @IsOptional() @IsString() @IsIn(['ENTRADA','SAIDA'])
  tipo?: string;

  @IsOptional() @IsString() @IsIn(DESTINACOES)
  destinacao?: string;

  @IsOptional() @IsString() @IsIn(TIPOS_FORN)
  tipoFornecedor?: string;

  @IsOptional() @IsString() @IsIn(TIPOS_CLI)
  tipoCliente?: string;

  @IsOptional() @IsString() @MaxLength(2)
  ufFornecedor?: string;

  @IsOptional() @IsString() @MaxLength(2)
  ufCliente?: string;

  @IsOptional() @IsString() @MaxLength(2)
  ufEmpresa?: string;

  @IsOptional() @IsBoolean()
  temST?: boolean;

  @IsOptional() @IsBoolean()
  stRetida?: boolean;

  @IsOptional() @IsBoolean()
  freteContaDestinatario?: boolean;

  @IsOptional() @IsString() @IsIn(FINALIDADES)
  finalidade?: string;
}
