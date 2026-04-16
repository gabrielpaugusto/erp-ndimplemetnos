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
import { CompanyService, UpdateCompanyDto, AddCnaeDto, FiscalModule } from './company.service';

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
    return this.companyService.update(user.companyId, dto, user.id);
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

  // ------------------------------------------------------------------
  // Tax Rates  — GET /company/tax-rates
  //              POST /company/tax-rates
  // ------------------------------------------------------------------

  @Get('tax-rates')
  getTaxRates(@CurrentUser() user: { id: string; companyId: string }) {
    return this.companyService.getTaxRates(user.companyId);
  }

  @Post('tax-rates')
  saveTaxRates(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() body: any,
  ) {
    return this.companyService.saveTaxRates(user.companyId, body, user.id);
  }

  @Get('fiscal-audit-log')
  getFiscalAuditLog(@CurrentUser() user: { id: string; companyId: string }) {
    return this.companyService.getFiscalAuditLog(user.companyId);
  }

  // ------------------------------------------------------------------
  // Tax Retention Config  — GET /company/tax-retention-config
  //                         POST /company/tax-retention-config
  // ------------------------------------------------------------------

  @Get('tax-retention-config')
  getTaxRetentionConfig(@CurrentUser() user: { id: string; companyId: string }) {
    return this.companyService.getTaxRetentionConfig(user.companyId);
  }

  @Post('tax-retention-config')
  saveTaxRetentionConfig(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() body: any,
  ) {
    return this.companyService.saveTaxRetentionConfig(user.companyId, body);
  }

  // ------------------------------------------------------------------
  // Multi-empresa  — GET  /company/all  (lista empresas do usuário)
  //                  POST /company/create (cria nova empresa e vincula ao usuário)
  // ------------------------------------------------------------------

  @Get('all')
  listUserCompanies(@CurrentUser() user: { id: string }) {
    return this.companyService.listUserCompanies(user.id);
  }

  @Post('create')
  createCompany(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companyService.createCompany(user.id, dto);
  }

  // ------------------------------------------------------------------
  // Module Start Dates — GET  /company/module-start-dates
  //                      POST /company/module-start-dates        (upsert único)
  //                      POST /company/module-start-dates/bulk   (upsert múltiplos)
  // ------------------------------------------------------------------

  @Get('module-start-dates')
  listModuleStartDates(@CurrentUser() user: { id: string; companyId: string }) {
    return this.companyService.listModuleStartDates(user.companyId);
  }

  @Post('module-start-dates')
  upsertModuleStartDate(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() body: { module: FiscalModule; startDate: string | null },
  ) {
    return this.companyService.upsertModuleStartDate(user.companyId, body.module, body.startDate);
  }

  @Post('module-start-dates/bulk')
  bulkUpsertModuleStartDates(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() body: Array<{ module: FiscalModule; startDate: string | null }>,
  ) {
    return this.companyService.bulkUpsertModuleStartDates(user.companyId, body);
  }
}
