import { Controller, Get } from '@nestjs/common';

@Controller('fi')
export class FiController {
  @Get()
  status() { return { module: 'FI', status: 'active' }; }
}
