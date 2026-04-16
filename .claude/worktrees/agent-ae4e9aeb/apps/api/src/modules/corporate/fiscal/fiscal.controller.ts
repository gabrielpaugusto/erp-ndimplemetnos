import { Controller, Get } from '@nestjs/common';

@Controller('fiscal')
export class FiscalController {
  @Get()
  status() { return { module: 'Fiscal', status: 'active' }; }
}
