import { PartialType } from '@nestjs/mapped-types';
import { CreateCfopDto } from './create-cfop.dto';

export class UpdateCfopDto extends PartialType(CreateCfopDto) {}
