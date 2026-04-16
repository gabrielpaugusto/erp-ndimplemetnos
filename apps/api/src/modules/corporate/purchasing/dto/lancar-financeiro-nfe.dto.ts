import { IsOptional, IsString, IsDateString, IsInt, Min } from 'class-validator';

export class LancarFinanceiroNfeDto {
  @IsDateString()
  dataVencimento: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  parcelas?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
