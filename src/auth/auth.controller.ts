import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Request,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, UpdateUserDto } from './auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  @Get('users')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List all users (admin)' })
  listUsers() {
    return this.authService.listUsers();
  }

  @Post('register')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create user (admin)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Put('users/:id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update user (admin)' })
  updateUser(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.authService.updateUser(req.user.id, id, dto);
  }

  @Delete('users/:id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Deactivate user (admin, soft delete)' })
  removeUser(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.authService.removeUser(req.user.id, id);
  }
}
