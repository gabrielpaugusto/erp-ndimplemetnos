import { PartialType } from '@nestjs/mapped-types';
import { CreatePointingDto } from './create-pointing.dto';

export class UpdatePointingDto extends PartialType(CreatePointingDto) {}
