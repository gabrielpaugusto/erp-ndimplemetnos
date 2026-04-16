import { IsString, IsOptional, IsInt, MaxLength } from 'class-validator';

export class CreateCfopDto {
  @IsString()
  @MaxLength(4)
  code: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  naturezaOp?: string;

  @IsString()
  @MaxLength(20)
  tipo: string;

  @IsOptional()
  @IsInt()
  indNFe?: number;
}
