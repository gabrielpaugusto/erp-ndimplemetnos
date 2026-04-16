import { Controller, Get } from '@nestjs/common';

@Controller('production')
export class ProductionController {
  @Get()
  status() { return { module: 'Production', status: 'active' }; }
}
