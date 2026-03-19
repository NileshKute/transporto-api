import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ClientService } from './client.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('clients')
export class ClientController {
  constructor(private clientService: ClientService) {}

  @Get()
  @ApiOperation({ summary: 'List all clients with search and filters' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query() query: any) {
    return this.clientService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get client by ID with vehicles' })
  findOne(@Param('id') id: string) {
    return this.clientService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new client' })
  create(@Body() dto: any) {
    return this.clientService.create(dto);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update a client' })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.clientService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Soft delete client (set isActive=false)' })
  remove(@Param('id') id: string) {
    return this.clientService.remove(id);
  }

  @Post(':id/vehicles')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Assign vehicle to client with billing type and rates' })
  @ApiBody({ schema: { type: 'object', properties: { vehicleId: { type: 'string' }, billingType: { type: 'string' }, monthlyRate: { type: 'number' }, tripRate: { type: 'number' }, route: { type: 'string' } } } })
  addVehicle(@Param('id') id: string, @Body() dto: any) {
    return this.clientService.addVehicle(id, dto);
  }

  @Delete(':clientId/vehicles/:vehicleId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Remove vehicle from client' })
  removeVehicle(@Param('clientId') clientId: string, @Param('vehicleId') vehicleId: string) {
    return this.clientService.removeVehicle(clientId, vehicleId);
  }
}
