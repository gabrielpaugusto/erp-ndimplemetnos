import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/core/auth/decorators/current-user.decorator';
import {
  UsersService,
  CreateUserDto,
  UpdateUserDto,
} from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users/roles  — lista roles disponíveis (antes de :id para não conflitar)
  @Get('roles')
  findRoles() {
    return this.usersService.findRoles();
  }

  // GET /users
  @Get()
  findAll(
    @CurrentUser() user: { id: string; companyId: string },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.findAll(user.companyId, { search, status, page, limit });
  }

  // GET /users/:id
  @Get(':id')
  findOne(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
  ) {
    return this.usersService.findOne(user.companyId, id);
  }

  // POST /users
  @Post()
  create(
    @CurrentUser() user: { id: string; companyId: string },
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(user.companyId, dto);
  }

  // PATCH /users/:id
  @Patch(':id')
  update(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user.companyId, id, dto);
  }

  // PATCH /users/:id/reset-password
  @Patch(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @CurrentUser() user: { id: string; companyId: string },
    @Param('id') id: string,
    @Body() body: { password: string },
  ) {
    return this.usersService.resetPassword(user.companyId, id, body.password);
  }
}
