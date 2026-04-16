import { Controller, Get } from '@nestjs/common';

@Controller('pcp')
export class PcpController {
  @Get()
  status() { return { module: 'PCP', status: 'active' }; }
}
