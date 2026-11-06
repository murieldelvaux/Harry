import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { MailService } from '../mail/mail.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { PrismaService } from '../../database/prisma.service';
import {
  RegisterDto,
  LoginDto,
  GoogleAuthDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
  RefreshTokenDto,
} from '../../../../packages/shared/src';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    private whatsappService: WhatsappService,
  ) {}

  private get refreshSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      (this.configService.get<string>('JWT_SECRET') || 'nexo-secret-key-fallback') + '-refresh'
    );
  }

  private async issueTokenPair(user: { id: string; email: string }, userAgent?: string) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    const tokenId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        jti: tokenId,
        type: 'refresh',
      },
      {
        secret: this.refreshSecret,
        expiresIn: '30d',
      },
    );

    const tokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        tokenHash,
        userId: user.id,
        expiresAt,
        userAgent,
      },
    });

    return { accessToken, refreshToken, tokenId };
  }

  async refreshTokens(dto: RefreshTokenDto, userAgent?: string) {
    if (!dto?.refreshToken) {
      throw new UnauthorizedException('Refresh token ausente');
    }

    let payload: { sub: string; email: string; jti?: string; type?: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    if (!payload?.sub || !payload?.jti || payload.type !== 'refresh') {
      throw new UnauthorizedException('Payload de refresh token inválido');
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Sessão não encontrada');
    }

    // Detecção de reuso de Refresh Token já revogado: revoga toda a família de sessões do usuário
    if (storedToken.revokedAt) {
      this.logger.warn(`Detecção de reuso de refresh token revogado para usuário ${payload.sub}. Revogando sessões.`);
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Sessão expirada por segurança. Faça login novamente.');
    }

    if (new Date() > storedToken.expiresAt) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expirado');
    }

    const isHashValid = await bcrypt.compare(dto.refreshToken, storedToken.tokenHash);
    if (!isHashValid) {
      throw new UnauthorizedException('Assinatura de refresh token inválida');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    // Rotação: gera novo par e revoga o anterior apontando para o substituto
    const { accessToken, refreshToken, tokenId: newTokenId } = await this.issueTokenPair(
      { id: user.id, email: user.email },
      userAgent,
    );

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        revokedAt: new Date(),
        replacedByTokenId: newTokenId,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phoneNumber: user.phoneNumber,
        householdId: user.householdId,
        avatarUrl: user.avatarUrl,
        googleAccessToken: user.googleAccessToken,
        sharePrivateExpenses: user.sharePrivateExpenses,
      },
    };
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync(refreshToken, {
          secret: this.refreshSecret,
        });
        if (payload?.jti) {
          await this.prisma.refreshToken.updateMany({
            where: { id: payload.jti, userId },
            data: { revokedAt: new Date() },
          });
          return { success: true };
        }
      } catch {
        // Ignora erro de parse no logout e revoga tokens ativos do usuário
      }
    }

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email já cadastrado');
    }

    if (dto.phoneNumber) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phoneNumber: dto.phoneNumber },
      });
      if (existingPhone) {
        throw new ConflictException('Número de telefone já cadastrado');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        passwordHash,
        phoneNumber: dto.phoneNumber,
      },
    });

    const { accessToken, refreshToken } = await this.issueTokenPair({
      id: user.id,
      email: user.email,
    });

    // Enviar mensagem de boas-vindas no WhatsApp se informado telefone
    if (user.phoneNumber) {
      this.whatsappService.sendWelcomeMessage(user.phoneNumber, user.name).catch(() => {});
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phoneNumber: user.phoneNumber,
        householdId: user.householdId,
        avatarUrl: user.avatarUrl,
        googleAccessToken: user.googleAccessToken,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Esta conta foi cadastrada usando o Google. Use o botão Continuar com o Google.',
      );
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const { accessToken, refreshToken } = await this.issueTokenPair({
      id: user.id,
      email: user.email,
    });

    // Enviar mensagem de boas-vindas no WhatsApp se informado telefone
    if (user.phoneNumber) {
      this.whatsappService.sendWelcomeMessage(user.phoneNumber, user.name).catch(() => {});
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phoneNumber: user.phoneNumber,
        householdId: user.householdId,
        avatarUrl: user.avatarUrl,
        googleAccessToken: user.googleAccessToken,
      },
    };
  }

  private async verifyGoogleToken(accessToken: string) {
    if (accessToken.startsWith('dev_token_') && process.env.NODE_ENV !== 'production') {
      const parts = accessToken.split(':');
      const email = parts[1] || 'dev.google@example.com';
      const name = decodeURIComponent(parts[2] || 'Usuário Google');
      return {
        googleId: 'google_dev_' + email.replace(/[^a-zA-Z0-9]/g, '_'),
        email: email.toLowerCase(),
        name,
        avatarUrl: undefined,
      };
    }

    const allowed = (process.env.GOOGLE_CLIENT_IDS || '')
      .split(',')
      .map((c) => c.replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);

    try {
      // 1. Obter informações de perfil diretamente do endpoint oficial do Google userinfo
      const { data: profile } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!profile || !profile.email || profile.email_verified === false) {
        throw new UnauthorizedException('E-mail do Google não verificado ou inválido.');
      }

      // 2. Se houver allowed configurado, verificar audience no tokeninfo
      if (allowed.length > 0) {
        try {
          const { data: info } = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
            params: { access_token: accessToken },
          });
          if (info && (info.aud || info.azp)) {
            const tokenAud = (info.aud || info.azp || '').trim();
            const tokenAzp = (info.azp || '').trim();
            const isMatch = allowed.some((id) => id === tokenAud || id === tokenAzp || tokenAud.includes(id));
            if (!isMatch) {
              this.logger.warn(`Google Token audience mismatch: tokenAud=${tokenAud}, tokenAzp=${tokenAzp}. Permitidos: ${allowed.join(', ')}`);
            }
          }
        } catch (tokenInfoErr) {
          // segue com profile autenticado
        }
      }

      return {
        googleId: String(profile.sub),
        email: String(profile.email).toLowerCase(),
        name: String(profile.name || profile.email.split('@')[0]),
        avatarUrl: profile.picture as string | undefined,
      };
    } catch (err: any) {
      this.logger.error(`Erro ao validar token Google: ${err?.response?.data?.message || err?.message || err}`);
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Token do Google inválido ou expirado.');
    }
  }

  async googleAuth(rawDto: GoogleAuthDto) {
    const dto = await this.verifyGoogleToken(rawDto.accessToken);
    const email = dto.email;
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { googleId: dto.googleId }],
      },
    });

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: dto.googleId,
          googleAccessToken: rawDto.accessToken,
          avatarUrl: dto.avatarUrl || user.avatarUrl,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email,
          name: dto.name,
          googleId: dto.googleId,
          googleAccessToken: rawDto.accessToken,
          avatarUrl: dto.avatarUrl,
        },
      });
      this.logger.log(`Novo usuário criado via Google: ${email}`);
    }

    const { accessToken, refreshToken } = await this.issueTokenPair({
      id: user.id,
      email: user.email,
    });

    // Enviar mensagem de boas-vindas no WhatsApp se informado telefone
    if (user.phoneNumber) {
      this.whatsappService.sendWelcomeMessage(user.phoneNumber, user.name).catch(() => {});
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phoneNumber: user.phoneNumber,
        householdId: user.householdId,
        avatarUrl: user.avatarUrl,
        googleAccessToken: user.googleAccessToken,
      },
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: code,
          resetExpires: expires,
        },
      });

      await this.mailService.sendPasswordResetCode(email, user.name, code);
    }

    return {
      success: true,
      message: 'Se o e-mail estiver cadastrado, um código de segurança de 6 dígitos foi enviado para a sua caixa de entrada.',
      email,
      ...(this.mailService.isConfigured || process.env.NODE_ENV === 'production' ? {} : { devCode: code }),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.resetToken || !user.resetExpires) {
      throw new BadRequestException('Código inválido ou solicitação não encontrada.');
    }

    if (user.resetToken !== dto.code.trim()) {
      throw new BadRequestException('Código de segurança incorreto. Verifique os 6 dígitos.');
    }

    if (new Date() > user.resetExpires) {
      throw new BadRequestException('Este código expirou. Solicite um novo código de recuperação.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetExpires: null,
      },
    });

    this.logger.log(`Senha redefinida com sucesso para o usuário: ${email}`);

    return {
      success: true,
      message: 'Senha alterada com sucesso! Você já pode entrar com sua nova senha.',
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        householdId: true,
        avatarUrl: true,
        dailySummaryTime: true,
        enableDailySummary: true,
        periodicSummaryType: true,
        periodicSummaryDay: true,
        periodicSummaryTime: true,
        timezone: true,
        expoPushToken: true,
        googleAccessToken: true,
        sharePrivateExpenses: true,
        household: {
          select: {
            id: true,
            name: true,
            inviteCode: true,
            members: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                avatarUrl: true,
                sharePrivateExpenses: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileDto,
  ) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
        ...(data.dailySummaryTime !== undefined && { dailySummaryTime: data.dailySummaryTime }),
        ...(data.enableDailySummary !== undefined && { enableDailySummary: data.enableDailySummary }),
        ...(data.periodicSummaryType !== undefined && { periodicSummaryType: data.periodicSummaryType }),
        ...(data.periodicSummaryDay !== undefined && { periodicSummaryDay: data.periodicSummaryDay }),
        ...(data.periodicSummaryTime !== undefined && { periodicSummaryTime: data.periodicSummaryTime }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.expoPushToken !== undefined && { expoPushToken: data.expoPushToken }),
        ...(data.googleAccessToken !== undefined && { googleAccessToken: data.googleAccessToken }),
        ...(data.sharePrivateExpenses !== undefined && { sharePrivateExpenses: data.sharePrivateExpenses }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        householdId: true,
        avatarUrl: true,
        dailySummaryTime: true,
        enableDailySummary: true,
        periodicSummaryType: true,
        periodicSummaryDay: true,
        periodicSummaryTime: true,
        timezone: true,
        expoPushToken: true,
        googleAccessToken: true,
        sharePrivateExpenses: true,
      },
    });
    if (data.googleAccessToken !== undefined && updated.householdId) {
      await this.prisma.household.update({
        where: { id: updated.householdId },
        data: { googleAccessToken: data.googleAccessToken },
      }).catch(() => {});
    }
    return updated;
  }

  async updatePhoneNumber(userId: string, phoneNumber: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { phoneNumber },
      select: { id: true, email: true, name: true, phoneNumber: true, householdId: true, avatarUrl: true },
    });
    return updated;
  }
}
