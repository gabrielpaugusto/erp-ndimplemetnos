import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import { ConsortiumService } from './consortium.service';
import { CreateConsortiumDto } from './dto/create-consortium.dto';
import { UpdateConsortiumDto } from './dto/update-consortium.dto';
import { CreateConsortiumPaymentDto } from './dto/create-consortium-payment.dto';
import { UpdateConsortiumPaymentDto } from './dto/update-consortium-payment.dto';

@Controller('fi/consortium')
@UseGuards(JwtAuthGuard)
export class ConsortiumController {
  constructor(private readonly consortiumService: ConsortiumService) {}

  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.consortiumService.findAll(user.companyId, {
      search,
      status,
      page,
      limit,
    });
  }

  @Get('stats')
  getStats(@CurrentUser() user: { id: string; companyId: string }) {
    return this.consortiumService.getStats(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.consortiumService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() createConsortiumDto: CreateConsortiumDto,
  ) {
    return this.consortiumService.create(user.companyId, createConsortiumDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateConsortiumDto: UpdateConsortiumDto,
  ) {
    return this.consortiumService.update(id, updateConsortiumDto);
  }

  @Post(':id/payments')
  addPayment(
    @Param('id') id: string,
    @Body() createPaymentDto: CreateConsortiumPaymentDto,
  ) {
    return this.consortiumService.addPayment(id, createPaymentDto);
  }

  @Patch('payments/:paymentId')
  updatePayment(
    @Param('paymentId') paymentId: string,
    @Body() updatePaymentDto: UpdateConsortiumPaymentDto,
  ) {
    return this.consortiumService.updatePayment(paymentId, updatePaymentDto);
  }

  @Post(':id/contemplate')
  contemplate(
    @Param('id') id: string,
    @Body() data: { tipoContemplacao: string; valorLance?: number; dataContemplacao?: string },
  ) {
    return this.consortiumService.contemplate(id, data);
  }
}
