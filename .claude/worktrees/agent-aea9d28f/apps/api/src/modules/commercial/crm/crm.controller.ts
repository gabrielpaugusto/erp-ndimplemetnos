import { Controller, Get } from '@nestjs/common';

@Controller('crm')
export class CrmController {
  @Get()
  status() { return { module: 'CRM', status: 'active' }; }
}
