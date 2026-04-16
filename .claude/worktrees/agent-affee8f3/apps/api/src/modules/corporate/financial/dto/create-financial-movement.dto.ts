import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  IsDateString,
  Min,
} from 'class-validator';

export enum FinancialMovementTypeEnum {
  RECEITA = 'RECEITA',
  DESPESA = 'DESPESA',
}

export enum PaymentMethodEnum {
  DINHEIRO = 'DINHEIRO',
  PIX = 'PIX',
  BOLETO = 'BOLETO',
  CARTAO_CREDITO = 'CARTAO_CREDITO',
  CARTAO_DEBITO = 'CARTAO_DEBITO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  CHEQUE = 'CHEQUE',
  PROMISSORIA = 'PROMISSORIA',
}

export class CreateFinancialMovementDto {
  @IsEnum(FinancialMovementTypeEnum)
  type: FinancialMovementTypeEnum;

  @IsString()
  personId: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  parcela?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalParcelas?: number;

  @IsNumber()
  @Min(0.01)
  valor: number;

  @IsDateString()
  dataEmissao: string;

  @IsDateString()
  dataVencimento: string;

  @IsOptional()
  @IsEnum(PaymentMethodEnum)
  paymentMethod?: PaymentMethodEnum;

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  nfeDocumentId?: string;

  @IsOptional()
  @IsString()
  saleOrderId?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
