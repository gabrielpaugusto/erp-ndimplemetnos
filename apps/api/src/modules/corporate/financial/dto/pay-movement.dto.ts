import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';
import { PaymentMethodEnum } from './create-financial-movement.dto';

export class PayMovementDto {
  @IsDateString()
  dataPagamento: string;

  @IsNumber()
  @Min(0.01)
  valorPago: number;

  @IsEnum(PaymentMethodEnum)
  paymentMethod: PaymentMethodEnum;

  @IsOptional()
  @IsString()
  bankAccountId?: string;
}
