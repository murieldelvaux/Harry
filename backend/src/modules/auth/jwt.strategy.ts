import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'nexo-secret-key-fallback',
    });
  }

  async validate(payload: { sub: string; email: string }) {
    let user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, householdId: true, phoneNumber: true },
    });

    if (!user && payload?.email) {
      user = await this.prisma.user.findUnique({
        where: { email: payload.email.toLowerCase() },
        select: { id: true, email: true, name: true, householdId: true, phoneNumber: true },
      });
    }

    if (!user && this.prisma.isUsingInMemoryFallback) {
      user = await this.prisma.user.findUnique({
        where: { id: 'user-1' },
        select: { id: true, email: true, name: true, householdId: true, phoneNumber: true },
      });
    }

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      householdId: user.householdId,
      phoneNumber: user.phoneNumber,
    };
  }
}
