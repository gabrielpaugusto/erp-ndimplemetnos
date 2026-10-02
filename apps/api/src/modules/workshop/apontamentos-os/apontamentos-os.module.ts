import { Module } from '@nestjs/common';
import { ApontamentosOsController } from './apontamentos-os.controller';
import { ApontamentosOsService } from './apontamentos-os.service';

@Module({
  controllers: [ApontamentosOsController],
  providers: [ApontamentosOsService],
  exports: [ApontamentosOsService],
})
export class ApontamentosOsModule {}
