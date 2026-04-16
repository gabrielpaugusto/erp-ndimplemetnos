import { Module } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';
import { AiToolsService } from './ai-tools.service';
import { InsightsService } from './insights.service';
import { InsightsController } from './insights.controller';

@Module({
  controllers: [AssistantController, InsightsController],
  providers: [AssistantService, AiToolsService, InsightsService],
  exports: [AssistantService, AiToolsService, InsightsService],
})
export class AiAssistantModule {}
