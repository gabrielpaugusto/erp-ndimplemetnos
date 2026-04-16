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
import { CompanyService, UpdateCompanyDto, AddCnaeDto } from './company.service';

@Controller('company')
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  // ------------------------------------------------------------------
  // Empresa
  // ------------------------------------------------------------------

  @Get()
  findOne(@CurrentUser() user: { id: string; companyId: string }) {
    return this.companyService.findOne(user.companyId);
  }

  @Patch()
  update(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companyService.update(user.companyId, dto);
  }

  // ------------------------------------------------------------------
  // CNAEs  — GET /company/cnaes
  //          POST /company/cnaes
  //          PATCH /company/cnaes/:id/principal
  //          PATCH /company/cnaes/:id
  //          DELETE /company/cnaes/:id
  // ------------------------------------------------------------------

  @Get('cnaes')
  findCnaes(@CurrentUser() user: { id: string; companyId: string }) {
    return this.companyService.findCnaes(user.companyId);
  }

  @Post('cnaes')
  addCnae(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: AddCnaeDto,
  ) {
    return this.companyService.addCnae(user.companyId, dto);
  }

  @Patch('cnaes/:id/principal')
  setPrincipal(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.companyService.setPrincipal(user.companyId, id);
  }

  @Patch('cnaes/:id')
  updateCnae(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() body: { descricao: string },
  ) {
    return this.companyService.updateCnae(user.companyId, id, body.descricao);
  }

  @Delete('cnaes/:id')
  removeCnae(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.companyService.removeCnae(user.companyId, id);
  }
}
