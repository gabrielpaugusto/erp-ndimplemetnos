import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { PersonsService } from './persons.service';
import { CreatePersonDto, CreateAddressDto, CreateContactDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

@Controller('persons')
@UseGuards(JwtAuthGuard)
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Get()
  findAll(
    @Query('companyId') companyId: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('role') role?: string,
    @Query('active') active?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.personsService.findAll(companyId, {
      search,
      type,
      role,
      active,
      page,
      limit,
    });
  }

  @Get('fiscal-data')
  findFiscalDataByCpfCnpj(
    @Query('cpfCnpj') cpfCnpj: string,
    @Request() req: any,
  ) {
    return this.personsService.findFiscalDataByCpfCnpj(cpfCnpj, req.user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.personsService.findOne(id);
  }

  @Get(':id/fiscal')
  findFiscalData(@Param('id') id: string, @Request() req: any) {
    return this.personsService.findFiscalData(id, req.user.companyId);
  }

  @Post()
  create(
    @Query('companyId') companyId: string,
    @Body() createPersonDto: CreatePersonDto,
  ) {
    return this.personsService.create(companyId, createPersonDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePersonDto: UpdatePersonDto) {
    return this.personsService.update(id, updatePersonDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.personsService.remove(id);
  }

  @Post(':id/addresses')
  addAddress(
    @Param('id') personId: string,
    @Body() createAddressDto: CreateAddressDto,
  ) {
    return this.personsService.addAddress(personId, createAddressDto);
  }

  @Post(':id/contacts')
  addContact(
    @Param('id') personId: string,
    @Body() createContactDto: CreateContactDto,
  ) {
    return this.personsService.addContact(personId, createContactDto);
  }
}
