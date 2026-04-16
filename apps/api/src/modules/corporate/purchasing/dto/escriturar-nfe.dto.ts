import { IsOptional, IsString } from 'class-validator';

export class EscriturarNfeDto {
  @IsOptional()
  @IsString()
  cfopCode?: string;

  @IsOptional()
  @IsString()
  naturezaOperacao?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
