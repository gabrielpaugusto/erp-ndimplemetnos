import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConsumoItemDto {
  /** ID do produto componente (deve ser item da OP) */
  @IsString()
  productId: string;

  /** Quantidade efetivamente consumida neste apontamento */
  @IsNumber()
  @Min(0.0001)
  quantityConsumed: number;
}

/**
 * A9 — Apontamento de consumo real por OP (Bloco K)
 * Registra quanto de cada insumo foi consumido e, opcionalmente,
 * quanto foi produzido neste apontamento parcial.
 */
export class ApontarConsumoDto {
  /** Qtd do produto acabado produzida neste apontamento (opcional; acumula) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityProduced?: number;

  /** Consumos reais por componente */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsumoItemDto)
  items: ConsumoItemDto[];
}
