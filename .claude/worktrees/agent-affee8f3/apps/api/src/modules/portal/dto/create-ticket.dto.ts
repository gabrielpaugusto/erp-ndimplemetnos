import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTicketDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  subject: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  priority?: string; // BAIXA, MEDIA, ALTA, URGENTE

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}
