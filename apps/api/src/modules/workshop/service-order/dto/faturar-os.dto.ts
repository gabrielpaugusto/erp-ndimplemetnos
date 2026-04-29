import {
  IsOptional,
  IsInt,
  IsEnum,
  IsDateString,
  IsString,
  Min,
  Max,
} from 'class-validator';

export enum PaymentMethodEnum {
  DINHEIRO      = 'DINHEIRO',
  PIX           = 'PIX',
  BOLETO        = 'BOLETO',
  CARTAO_CREDITO = 'CARTAO_CREDITO',
  CARTAO_DEBITO  = 'CARTAO_DEBITO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  CHEQUE        = 'CHEQUE',
  PROMISSORIA   = 'PROMISSORIA',
}

export class FaturarOsDto {
  /** Número de parcelas. 1 = à vista. Default: 1 */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  numParcelas?: number;

  /** Intervalo em dias entre parcelas. Default: 30 */
  @IsOptional()
  @IsInt()
  @Min(1)
  intervaloDias?: number;

  /** Data de vencimento da 1ª parcela (ISO date). Default: hoje */
  @IsOptional()
  @IsDateString()
  dataVencimento1?: string;

  /** Forma de pagamento */
  @IsOptional()
  @IsEnum(PaymentMethodEnum)
  formaPagamento?: PaymentMethodEnum;

  /** Observações adicionais */
  @IsOptional()
  @IsString()
  observations?: string;
}
