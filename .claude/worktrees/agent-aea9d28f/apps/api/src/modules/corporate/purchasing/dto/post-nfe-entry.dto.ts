import { IsDateString, IsOptional, IsString } from 'class-validator';

export class PostNfeEntryDto {
  @IsString()
  inboxId: string;

  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @IsOptional()
  @IsString()
  stockLocationId?: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsDateString()
  dataVencimento?: string;
}
