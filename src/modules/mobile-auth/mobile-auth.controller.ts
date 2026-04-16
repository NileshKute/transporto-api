import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { MobileAuthService } from './mobile-auth.service';

class SendOtpDto {
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;
}

class VerifyOtpDto {
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @IsNotEmpty()
  @IsString()
  otp: string;
}

class RegisterDeviceDto {
  @IsNotEmpty()
  @IsString()
  token: string;

  @IsNotEmpty()
  @IsIn(['android', 'ios'])
  platform: string;
}

@ApiTags('MobileAuth')
@Controller('auth/mobile')
export class MobileAuthController {
  constructor(private service: MobileAuthService) {}

  @Public()
  @Post('send-otp')
  @ApiOperation({ summary: 'Send OTP via WhatsApp to driver phone' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.service.sendOtp(dto.phoneNumber);
  }

  @Public()
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and get JWT token' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.service.verifyOtp(dto.phoneNumber, dto.otp);
  }

  @Post('register-device')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register Expo push token for this user' })
  registerDevice(
    @Req() req: { user: { id: string } },
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.service.registerDevice(req.user.id, dto.token, dto.platform);
  }
}
