import { Module } from '@nestjs/common';
import { TarefasCatalogoController } from './tarefas-catalogo.controller';
import { TarefasCatalogoService } from './tarefas-catalogo.service';

@Module({
  controllers: [TarefasCatalogoController],
  providers: [TarefasCatalogoService],
  exports: [TarefasCatalogoService],
})
export class TarefasCatalogoModule {}
