import { IsOptional, IsString } from 'class-validator';

export class RecepcionarNfeDto {
  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @IsOptional()
  @IsString()
  stockLocationId?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
