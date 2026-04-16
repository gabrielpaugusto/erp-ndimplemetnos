import { Controller, Get } from '@nestjs/common';

@Controller('financial')
export class FinancialController {
  @Get()
  status() { return { module: 'Financial', status: 'active' }; }
}
