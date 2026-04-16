import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ShareDocumentDto {
  @IsNotEmpty()
  @IsString()
  personId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  fileUrl: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  fileType: string;

  @IsOptional()
  @IsInt()
  fileSize?: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  category: string; // nfe, boleto, contrato, orcamento, os

  @IsOptional()
  @IsString()
  saleOrderId?: string;

  @IsOptional()
  @IsString()
  nfeDocumentId?: string;

  @IsOptional()
  @IsString()
  serviceOrderId?: string;
}
