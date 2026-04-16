import { Controller, Get } from '@nestjs/common';

@Controller('quality')
export class QualityController {
  @Get()
  status() { return { module: 'Quality', status: 'active' }; }
}
