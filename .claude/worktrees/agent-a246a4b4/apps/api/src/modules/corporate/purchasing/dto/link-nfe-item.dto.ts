import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class LinkNfeItemDto {
  @IsString()
  inboxItemId: string;

  @IsString()
  productId: string;

  @IsOptional()
  @IsBoolean()
  saveLink?: boolean;
}

export class CreateAndLinkDto {
  @IsString()
  inboxItemId: string;

  @IsString()
  code: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  ncmId?: string;

  @IsString()
  unit: string;
}
