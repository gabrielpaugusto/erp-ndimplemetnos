import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
} from 'class-validator';

export enum BankTransactionTypeEnum {
  CREDITO = 'CREDITO',
  DEBITO = 'DEBITO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  APLICACAO = 'APLICACAO',
  RESGATE = 'RESGATE',
}

export class CreateBankTransactionDto {
  @IsString()
  bankAccountId: string;

  @IsEnum(BankTransactionTypeEnum)
  type: BankTransactionTypeEnum;

  @IsString()
  description: string;

  @IsNumber()
  value: number;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  financialMovementId?: string;
}
