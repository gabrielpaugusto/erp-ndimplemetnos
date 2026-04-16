import { Controller, Get } from '@nestjs/common';

@Controller('hr')
export class HrController {
  @Get()
  status() { return { module: 'HR', status: 'active' }; }
}
