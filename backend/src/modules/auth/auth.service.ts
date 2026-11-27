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
import { TokenCryptoService } from '../../common/crypto/token-crypto.service';
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
    private tokenCrypto: TokenCryptoService,
  ) {}

  private serializeAuthUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phoneNumber: user.phoneNumber,
      householdId: user.householdId,
      avatarUrl: user.avatarUrl,
      hasGoogleConnected: Boolean(user.googleAccessToken || user.googleRefreshToken),
      sharePrivateExpenses: user.sharePrivateExpenses,
    };
  }

  private getGoogleClientId(): string | undefined {
    const direct =
      this.configService.get<string>('GOOGLE_CLIENT_ID') ||
      this.configService.get<string>('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
    if (direct && direct.trim()) return direct.trim();
    const list = (this.configService.get<string>('GOOGLE_CLIENT_IDS') || '')
      .split(',')
      .map((s) => s.replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
    return list[0];
  }

  async exchangeGoogleAuthCode(params: {
    code: string;
    codeVerifier?: string;
    redirectUri?: string;
  }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
    idToken?: string;
  }> {
    const clientId = this.getGoogleClientId();
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados no servidor para troca de código OAuth.',
      );
    }

    const body = new URLSearchParams({
      code: params.code,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
    });

    if (params.codeVerifier) {
      body.append('code_verifier', params.codeVerifier);
    }
    if (params.redirectUri) {
      body.append('redirect_uri', params.redirectUri);
    }

    try {
      const { data } = await axios.post(
        'https://oauth2.googleapis.com/token',
        body.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        },
      );

      if (!data?.access_token) {
        throw new UnauthorizedException('Google não retornou access_token na troca do código.');
      }

      const expiresInSec = Number(data.expires_in) || 3600;
      return {
        accessToken: String(data.access_token),
        refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
        expiresAt: new Date(Date.now() + expiresInSec * 1000),
        idToken: data.id_token ? String(data.id_token) : undefined,
      };
    } catch (err: any) {
      if (err instanceof UnauthorizedException || err instanceof BadRequestException) {
        throw err;
      }
      const errCode = err?.response?.data?.error || err?.message || 'oauth_exchange_failed';
      this.logger.error(`Falha ao trocar authorization code do Google: ${errCode}`);
      throw new UnauthorizedException('Não foi possível validar a autorização do Google. Tente novamente.');
    }
  }

  async getValidGoogleAccessToken(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        googleAccessToken: true,
        googleRefreshToken: true,
        googleTokenExpiresAt: true,
      },
    });

    if (!user) return null;

    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    try {
      accessToken = this.tokenCrypto.decrypt(user.googleAccessToken);
      refreshToken = this.tokenCrypto.decrypt(user.googleRefreshToken);
    } catch (err: any) {
      this.logger.error(`Falha ao descriptografar token Google do usuário ${userId}: ${err?.message}`);
      return null;
    }

    if (accessToken && (accessToken.startsWith('dev_token_') || accessToken.startsWith('AIzaSy'))) {
      return accessToken;
    }

    const fiveMinutesMs = 5 * 60 * 1000;
    const isNearExpiry =
      !accessToken ||
      !user.googleTokenExpiresAt ||
      user.googleTokenExpiresAt.getTime() <= Date.now() + fiveMinutesMs;

    if (!isNearExpiry && accessToken) {
      return accessToken;
    }

    if (!refreshToken) {
      return accessToken;
    }

    const clientId = this.getGoogleClientId();
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return accessToken;
    }

    try {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const { data } = await axios.post(
        'https://oauth2.googleapis.com/token',
        body.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        },
      );

      const newAccessToken = String(data.access_token || '');
      if (!newAccessToken) return accessToken;

      const expiresInSec = Number(data.expires_in) || 3600;
      const newExpiresAt = new Date(Date.now() + expiresInSec * 1000);
      const encryptedAccess = this.tokenCrypto.encrypt(newAccessToken);
      const encryptedRefresh = data.refresh_token
        ? this.tokenCrypto.encrypt(String(data.refresh_token))
        : undefined;

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: encryptedAccess,
          googleTokenExpiresAt: newExpiresAt,
          ...(encryptedRefresh ? { googleRefreshToken: encryptedRefresh } : {}),
        },
      });

      return newAccessToken;
    } catch (err: any) {
      const errCode = err?.response?.data?.error;
      if (errCode === 'invalid_grant' || err?.response?.status === 400 || err?.response?.status === 401) {
        this.logger.warn(`Google refresh token revogado/inválido para usuário ${userId} (${errCode}). Limpando vínculo Google.`);
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            googleAccessToken: null,
            googleRefreshToken: null,
            googleTokenExpiresAt: null,
          },
        });
        return null;
      }
      this.logger.warn(`Falha transitória ao renovar token Google do usuário ${userId}: ${err?.message}`);
      return accessToken;
    }
  }

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
      user: this.serializeAuthUser(user),
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
      user: this.serializeAuthUser(user),
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
      user: this.serializeAuthUser(user),
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
      let profile: any = null;

      // 1. Suporta idToken (formato JWT com 3 partes: eyJ...)
      if (accessToken.startsWith('eyJ') && accessToken.split('.').length === 3) {
        try {
          const { data: idTokenInfo } = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
            params: { id_token: accessToken },
            timeout: 8000,
          });
          profile = {
            sub: idTokenInfo.sub,
            email: idTokenInfo.email,
            email_verified: idTokenInfo.email_verified === 'true' || idTokenInfo.email_verified === true,
            name: idTokenInfo.name || idTokenInfo.email?.split('@')[0],
            picture: idTokenInfo.picture,
          };
        } catch (idErr: any) {
          this.logger.warn(`Validação via id_token falhou, tentando userinfo...: ${idErr?.message}`);
        }
      }

      // 2. Se não foi validado como idToken, obter informações de perfil do endpoint userinfo (Bearer accessToken)
      if (!profile) {
        try {
          const { data: userinfo } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 8000,
          });
          profile = userinfo;
        } catch (userinfoErr: any) {
          // Fallback final: tokeninfo via access_token
          const { data: tokeninfo } = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
            params: { access_token: accessToken },
            timeout: 8000,
          });
          profile = {
            sub: tokeninfo.sub || tokeninfo.user_id,
            email: tokeninfo.email,
            email_verified: tokeninfo.email_verified === 'true' || tokeninfo.email_verified === true,
            name: tokeninfo.email?.split('@')[0],
            picture: undefined,
          };
        }
      }

      if (!profile || !profile.email || profile.email_verified === false) {
        throw new UnauthorizedException('E-mail do Google não verificado ou inválido.');
      }

      // 3. Se houver allowed configurado, verificar audience no tokeninfo
      if (allowed.length > 0) {
        try {
          const { data: info } = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
            params: { access_token: accessToken },
            timeout: 5000,
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
    let rawAccessToken = rawDto.accessToken;
    let rawRefreshToken: string | undefined;
    let tokenExpiresAt: Date | undefined;
    let tokenForVerification: string | undefined = rawDto.accessToken;

    if (rawDto.code) {
      const exchanged = await this.exchangeGoogleAuthCode({
        code: rawDto.code,
        codeVerifier: rawDto.codeVerifier,
        redirectUri: rawDto.redirectUri,
      });
      rawAccessToken = exchanged.accessToken;
      rawRefreshToken = exchanged.refreshToken;
      tokenExpiresAt = exchanged.expiresAt;
      tokenForVerification = exchanged.idToken || exchanged.accessToken;
    }

    if (!tokenForVerification || !rawAccessToken) {
      throw new BadRequestException('Código de autorização ou token do Google obrigatório.');
    }

    const dto = await this.verifyGoogleToken(tokenForVerification);
    const email = dto.email;
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { googleId: dto.googleId }],
      },
    });

    const encryptedAccess = this.tokenCrypto.encrypt(rawAccessToken);
    const encryptedRefresh = rawRefreshToken ? this.tokenCrypto.encrypt(rawRefreshToken) : undefined;
    const expiresAt = tokenExpiresAt || new Date(Date.now() + 55 * 60 * 1000);

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: dto.googleId,
          googleAccessToken: encryptedAccess,
          ...(encryptedRefresh ? { googleRefreshToken: encryptedRefresh } : {}),
          googleTokenExpiresAt: expiresAt,
          avatarUrl: dto.avatarUrl || user.avatarUrl,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email,
          name: dto.name,
          googleId: dto.googleId,
          googleAccessToken: encryptedAccess,
          googleRefreshToken: encryptedRefresh || null,
          googleTokenExpiresAt: expiresAt,
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
      user: this.serializeAuthUser(user),
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
        googleRefreshToken: true,
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

    const { googleAccessToken, googleRefreshToken, ...safeUser } = user;
    return {
      ...safeUser,
      hasGoogleConnected: Boolean(googleAccessToken || googleRefreshToken),
    };
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileDto,
  ) {
    let encryptedGoogleAccess: string | null | undefined;
    let encryptedGoogleRefresh: string | null | undefined;
    let googleTokenExpiresAt: Date | undefined;

    if (data.googleAuthCode) {
      const exchanged = await this.exchangeGoogleAuthCode({
        code: data.googleAuthCode,
        codeVerifier: data.googleCodeVerifier,
        redirectUri: data.googleRedirectUri,
      });
      encryptedGoogleAccess = this.tokenCrypto.encrypt(exchanged.accessToken);
      if (exchanged.refreshToken) {
        encryptedGoogleRefresh = this.tokenCrypto.encrypt(exchanged.refreshToken);
      }
      googleTokenExpiresAt = exchanged.expiresAt;
    } else if (data.googleAccessToken !== undefined) {
      encryptedGoogleAccess = data.googleAccessToken
        ? this.tokenCrypto.encrypt(data.googleAccessToken)
        : null;
      if (data.googleAccessToken) {
        googleTokenExpiresAt = new Date(Date.now() + 55 * 60 * 1000);
      }
    }

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
        ...(encryptedGoogleAccess !== undefined && { googleAccessToken: encryptedGoogleAccess }),
        ...(encryptedGoogleRefresh !== undefined && { googleRefreshToken: encryptedGoogleRefresh }),
        ...(googleTokenExpiresAt !== undefined && { googleTokenExpiresAt }),
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
        googleRefreshToken: true,
        sharePrivateExpenses: true,
      },
    });
    if (encryptedGoogleAccess !== undefined && updated.householdId) {
      await this.prisma.household.update({
        where: { id: updated.householdId },
        data: {
          googleAccessToken: encryptedGoogleAccess,
          ...(encryptedGoogleRefresh !== undefined ? { googleRefreshToken: encryptedGoogleRefresh } : {}),
        },
      }).catch(() => {});
    }
    const { googleAccessToken, googleRefreshToken, ...safeUpdated } = updated;
    return {
      ...safeUpdated,
      hasGoogleConnected: Boolean(googleAccessToken || googleRefreshToken),
    };
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
