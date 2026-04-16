import { Module } from '@nestjs/common';
import { FiscalBrainService } from './fiscal-brain.service';
import { FiscalBrainController } from './fiscal-brain.controller';
import { ClassificadorService } from './classificador.service';
import { ValidadorService } from './validador.service';
import { ExcoesQueueService } from './excecoes-queue.service';
import { FeedbackLoopService } from './feedback-loop.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { FiscalBrainChatService } from './fiscal-brain-chat.service';

@Module({
  controllers: [FiscalBrainController],
  providers: [
    FiscalBrainService,
    ClassificadorService,
    ValidadorService,
    ExcoesQueueService,
    FeedbackLoopService,
    KnowledgeBaseService,
    FiscalBrainChatService,
  ],
  exports: [FiscalBrainService, FiscalBrainChatService],
})
export class FiscalBrainModule {}
