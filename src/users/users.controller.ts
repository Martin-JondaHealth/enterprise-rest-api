import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateRoleDto, UpdateStatusDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users (RBAC Protected)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.ADMIN)
  @Get()
  @ApiOperation({
    summary: 'List all users (Admin only)',
    description: 'Requires ADMIN role. Returns list of registered users.',
  })
  @ApiResponse({ status: 200, description: 'List of users retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires ADMIN role' })
  findAll() {
    return this.usersService.findAll();
  }

  @Roles(Role.ADMIN, Role.MEMBER, Role.VIEWER)
  @Get(':id')
  @ApiOperation({
    summary: 'Get user details by ID',
    description: 'Accessible by Admin, Member, or Viewer.',
  })
  @ApiResponse({ status: 200, description: 'User record found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/role')
  @ApiOperation({
    summary: 'Update user role (Admin only)',
    description: 'Allows Admin to promote or demote a user.',
  })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.usersService.updateRole(id, dto.role);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Activate or deactivate user account (Admin only)',
    description: 'Admin can freeze or unfreeze user accounts.',
  })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.usersService.updateStatus(id, dto.isActive);
  }
}
