import { Module } from '@nestjs/common';
import { ApontamentosService } from './apontamentos.service';
import { ApontamentosController } from './apontamentos.controller';

@Module({
  controllers: [ApontamentosController],
  providers: [ApontamentosService],
  exports: [ApontamentosService],
})
export class ApontamentosModule {}
