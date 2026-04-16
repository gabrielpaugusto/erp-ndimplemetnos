import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NfseService } from './nfse.service';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('fiscal/nfse')
export class NfseController {
  constructor(private readonly nfseService: NfseService) {}

  // -----------------------------------------------------------------------
  // NFS-e Emitidas
  // -----------------------------------------------------------------------

  @Get('emitidas')
  findAllEmitidas(
    @CurrentUser() user: { companyId: string },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.nfseService.findAllEmitidas(
      user.companyId,
      +page,
      +limit,
    );
  }

  @Get('emitidas/:id')
  findOne(
    @CurrentUser() user: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.nfseService.findOneEmitida(user.companyId, id);
  }

  @Post('emitidas')
  criar(
    @CurrentUser() user: { companyId: string },
    @Body() dto: any,
  ) {
    return this.nfseService.criarRascunho(user.companyId, dto);
  }

  @Post('emitidas/:id/emitir')
  emitir(
    @CurrentUser() user: { companyId: string },
    @Param('id') id: string,
  ) {
    return this.nfseService.emitir(user.companyId, id);
  }

  @Delete('emitidas/:id')
  cancelar(
    @CurrentUser() user: { companyId: string },
    @Param('id') id: string,
    @Body() body: { motivo: string },
  ) {
    return this.nfseService.cancelar(user.companyId, id, body.motivo);
  }

  // -----------------------------------------------------------------------
  // NFS-e Recebidas
  // -----------------------------------------------------------------------

  @Get('recebidas')
  findAllRecebidas(
    @CurrentUser() user: { companyId: string },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.nfseService.findAllRecebidas(
      user.companyId,
      +page,
      +limit,
    );
  }

  @Post('recebidas/sync')
  sincronizar(@CurrentUser() user: { companyId: string }) {
    return this.nfseService.sincronizarRecebidas(user.companyId);
  }

  @Post('recebidas/:id/escriturar')
  escriturarRecebida(
    @CurrentUser() user: { companyId: string; sub: string },
    @Param('id') id: string,
  ) {
    return this.nfseService.escriturarRecebida(id, user.companyId, user.sub);
  }

  @Post('emitidas/:id/escriturar')
  escriturarEmitida(
    @CurrentUser() user: { companyId: string; sub: string },
    @Param('id') id: string,
  ) {
    return this.nfseService.escriturarEmitida(id, user.companyId, user.sub);
  }
}
