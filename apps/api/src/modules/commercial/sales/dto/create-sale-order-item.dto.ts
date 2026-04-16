import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateSaleOrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0.0001)
  quantidade: number;

  @IsNumber()
  @Min(0)
  precoUnitario: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  desconto?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
