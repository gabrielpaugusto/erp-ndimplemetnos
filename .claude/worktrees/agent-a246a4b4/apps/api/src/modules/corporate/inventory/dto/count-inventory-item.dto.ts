import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CountInventoryItemDto {
  @IsNumber()
  @Min(0)
  quantidadeContada: number;

  @IsOptional()
  @IsString()
  justificativa?: string;
}
