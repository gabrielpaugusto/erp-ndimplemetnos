import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class LinkNfeItemDto {
  @IsString()
  inboxItemId: string;

  @IsString()
  productId: string;

  @IsOptional()
  @IsBoolean()
  saveLink?: boolean;

  @IsOptional()
  @IsString()
  ncmDivergenciaStatus?: string; // 'ERRO_INTERNO' | 'ERRO_FORNECEDOR'

  @IsOptional()
  @IsString()
  ncmDivergenciaObs?: string;
}

export class CreateAndLinkDto {
  @IsString()
  inboxItemId: string;

  @IsString()
  code: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  ncmId?: string;

  @IsString()
  unit: string;

  @IsOptional()
  @IsString()
  ncmDivergenciaStatus?: string;

  @IsOptional()
  @IsString()
  ncmDivergenciaObs?: string;
}
