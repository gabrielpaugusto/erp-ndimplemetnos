import { IsInt, IsNumber, IsDateString, Min } from 'class-validator';

export class CreateConsortiumPaymentDto {
  @IsInt()
  @Min(1)
  numeroParcela: number;

  @IsDateString()
  dataVencimento: string;

  @IsNumber()
  @Min(0)
  valor: number;
}
