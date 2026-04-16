import { IsNumber, IsString, IsOptional } from 'class-validator';

export class PararApontamentoDto {
  @IsNumber()
  @IsOptional()
  quantidadeProduzida?: number;

  @IsNumber()
  @IsOptional()
  quantidadeRejeitada?: number;

  @IsString()
  @IsOptional()
  motivoParada?: string;

  @IsString()
  @IsOptional()
  observations?: string;
}
