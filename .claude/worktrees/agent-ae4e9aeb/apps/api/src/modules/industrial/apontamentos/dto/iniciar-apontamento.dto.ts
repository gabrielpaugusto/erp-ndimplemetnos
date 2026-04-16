import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum TipoVinculo {
  PRODUCAO = 'PRODUCAO',
  OFICINA = 'OFICINA',
  CALDERARIA = 'CALDERARIA',
}

export class IniciarApontamentoDto {
  @IsEnum(TipoVinculo)
  tipo: TipoVinculo;

  // Produção
  @IsString()
  @IsOptional()
  productionOrderId?: string;

  @IsString()
  @IsOptional()
  routingStepId?: string;

  // Oficina
  @IsString()
  @IsOptional()
  serviceOrderId?: string;

  @IsString()
  @IsOptional()
  etapaOsId?: string;

  // Calderaria
  @IsString()
  @IsOptional()
  calderariaOrderId?: string;

  @IsString()
  @IsOptional()
  etapaCalderariaId?: string;
}
