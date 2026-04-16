import { IsString, IsNumber, IsBoolean, IsOptional, Matches } from 'class-validator';

export class CreateJornadaDto {
  @IsString()
  nome: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'horaInicio deve ser no formato HH:MM' })
  horaInicio: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'horaFim deve ser no formato HH:MM' })
  horaFim: string;

  @IsNumber()
  @IsOptional()
  intervaloH?: number;

  @IsBoolean()
  @IsOptional()
  segSex?: boolean;

  @IsBoolean()
  @IsOptional()
  sabado?: boolean;

  @IsBoolean()
  @IsOptional()
  domingo?: boolean;
}
