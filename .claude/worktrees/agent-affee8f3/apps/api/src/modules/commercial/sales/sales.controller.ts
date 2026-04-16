import { Controller, Get } from '@nestjs/common';

@Controller('sales')
export class SalesController {
  @Get()
  status() { return { module: 'Sales', status: 'active' }; }
}
