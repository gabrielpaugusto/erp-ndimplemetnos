import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class PortalLoginDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
