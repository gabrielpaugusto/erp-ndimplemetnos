import { PartialType } from '@nestjs/mapped-types';
import { CreateNcmDto } from './create-ncm.dto';

export class UpdateNcmDto extends PartialType(CreateNcmDto) {}
