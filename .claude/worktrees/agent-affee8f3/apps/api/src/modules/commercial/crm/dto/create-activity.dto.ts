import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreateActivityDto {
  @IsString()
  type: string; // ActivityType enum value

  @IsString()
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
