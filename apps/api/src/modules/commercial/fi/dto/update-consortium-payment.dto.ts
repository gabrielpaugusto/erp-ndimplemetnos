import { IsOptional, IsNumber, IsDateString, IsString, Min } from 'class-validator';

export class UpdateConsortiumPaymentDto {
  @IsOptional()
  @IsDateString()
  dataPagamento?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorPago?: number;

  @IsOptional()
  @IsString()
  status?: string;
}
