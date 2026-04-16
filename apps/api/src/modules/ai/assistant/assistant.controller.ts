import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { AssistantService } from './assistant.service';
import { AiToolsService } from './ai-tools.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('ai/assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(
    private readonly assistantService: AssistantService,
    private readonly aiTools: AiToolsService,
  ) {}

  @Get('conversations')
  getConversations(@CurrentUser() user: { id: string; companyId: string }) {
    return this.assistantService.getConversations(user.id, user.companyId);
  }

  @Post('conversations')
  createConversation(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateConversationDto,
  ) {
    return this.assistantService.createConversation(
      user.id,
      user.companyId,
      dto,
    );
  }

  @Get('conversations/:id')
  getConversation(@Param('id') id: string) {
    return this.assistantService.getConversation(id);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: SendMessageDto,
  ) {
    return this.assistantService.sendMessage(id, user.id, user.companyId, dto);
  }

  @Patch('conversations/:id/archive')
  archiveConversation(@Param('id') id: string) {
    return this.assistantService.archiveConversation(id);
  }

  @Delete('conversations/:id')
  deleteConversation(@Param('id') id: string) {
    return this.assistantService.deleteConversation(id);
  }

  // ── Sprint 4.3 — Copiloto IA ────────────────────────────────────────────

  /** GET /ai/assistant/copilot/op-atrasada?opId=xxx */
  @Get('copilot/op-atrasada')
  copilotOpAtrasada(
    @CurrentUser() user: { companyId: string },
    @Query('opId') opId: string,
  ) {
    return this.aiTools.copilotOpAtrasada(user.companyId, opId);
  }

  /** GET /ai/assistant/copilot/prazo-realista?opId=xxx */
  @Get('copilot/prazo-realista')
  copilotPrazoRealista(
    @CurrentUser() user: { companyId: string },
    @Query('opId') opId: string,
  ) {
    return this.aiTools.copilotPrazoRealista(user.companyId, opId);
  }

  /** GET /ai/assistant/copilot/fornecedor-performance?supplierId=xxx */
  @Get('copilot/fornecedor-performance')
  copilotFornecedorPerformance(
    @CurrentUser() user: { companyId: string },
    @Query('supplierId') supplierId: string,
  ) {
    return this.aiTools.copilotFornecedorPerformance(user.companyId, supplierId);
  }

  /** GET /ai/assistant/copilot/risco-inadimplencia?personId=xxx */
  @Get('copilot/risco-inadimplencia')
  copilotRiscoInadimplencia(
    @CurrentUser() user: { companyId: string },
    @Query('personId') personId: string,
  ) {
    return this.aiTools.copilotRiscoInadimplencia(user.companyId, personId);
  }

  /** GET /ai/assistant/copilot/sugestao-compra */
  @Get('copilot/sugestao-compra')
  copilotSugestaoCompra(@CurrentUser() user: { companyId: string }) {
    return this.aiTools.copilotSugestaoCompra(user.companyId);
  }
}
