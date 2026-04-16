import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateBankAccountDto {
  @IsString()
  name: string;

  @IsString()
  banco: string;

  @IsString()
  agencia: string;

  @IsString()
  conta: string;

  @IsString()
  tipoConta: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  saldoInicial?: number;
}
