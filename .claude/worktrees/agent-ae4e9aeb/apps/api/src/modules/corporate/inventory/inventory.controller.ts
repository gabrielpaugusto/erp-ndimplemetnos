import { Controller, Get } from '@nestjs/common';

@Controller('inventory')
export class InventoryController {
  @Get()
  status() { return { module: 'Inventory', status: 'active' }; }
}
