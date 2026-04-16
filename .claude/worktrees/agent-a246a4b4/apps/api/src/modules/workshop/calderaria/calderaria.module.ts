import { Module } from '@nestjs/common';
import { CalderariaController } from './calderaria.controller';
import { CalderariaService } from './calderaria.service';

@Module({
  controllers: [CalderariaController],
  providers: [CalderariaService],
  exports: [CalderariaService],
})
export class CalderariaModule {}
