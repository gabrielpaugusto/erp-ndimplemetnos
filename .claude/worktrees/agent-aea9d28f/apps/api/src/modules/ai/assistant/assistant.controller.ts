import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { AssistantService } from './assistant.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('ai/assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

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
}
