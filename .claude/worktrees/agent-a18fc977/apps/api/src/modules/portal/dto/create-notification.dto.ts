import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNotificationDto {
  @IsOptional()
  @IsString()
  type?: string; // INFO, ALERTA, ERRO, SUCESSO, LEMBRETE

  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  title: string;

  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  link?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  portalUserId?: string;
}
