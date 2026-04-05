import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Locations')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('locations')
export class LocationsController {
  constructor(private locationsService: LocationsService) {}

  @Get()
  @RequirePermission('trips', 'view')
  @ApiOperation({ summary: 'List active locations (optional search)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query() query: Record<string, string | undefined>) {
    return this.locationsService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('trips', 'view')
  @ApiOperation({ summary: 'Get one location' })
  findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }

  @Post()
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'CEO',
    'MANAGER',
    'ACCOUNTANT',
    'DRIVER',
    'COLD_STORAGE_OPERATOR',
    'VIEWER',
  )
  @RequirePermission('trips', 'create')
  @ApiOperation({ summary: 'Create location' })
  create(@Body() dto: any) {
    if (!dto?.name || !String(dto.name).trim()) {
      throw new BadRequestException('name is required');
    }
    return this.locationsService.create(dto);
  }

  @Put(':id')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'CEO',
    'MANAGER',
    'ACCOUNTANT',
    'DRIVER',
    'COLD_STORAGE_OPERATOR',
    'VIEWER',
  )
  @RequirePermission('trips', 'edit')
  @ApiOperation({ summary: 'Update location' })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.locationsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'CEO',
    'MANAGER',
    'ACCOUNTANT',
    'DRIVER',
    'COLD_STORAGE_OPERATOR',
    'VIEWER',
  )
  @RequirePermission('trips', 'delete')
  @ApiOperation({ summary: 'Soft-delete location (isActive=false)' })
  remove(@Param('id') id: string) {
    return this.locationsService.remove(id);
  }
}
