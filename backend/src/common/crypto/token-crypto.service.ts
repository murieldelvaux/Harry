import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ENC_PREFIX = 'enc:v1:';

@Injectable()
export class TokenCryptoService {
  private readonly logger = new Logger(TokenCryptoService.name);
  private readonly key: Buffer;

  constructor(private readonly configService?: ConfigService) {
    const rawKey =
      this.configService?.get<string>('TOKEN_ENCRYPTION_KEY') ||
      process.env.TOKEN_ENCRYPTION_KEY;

    if (rawKey && /^[0-9a-fA-F]{64}$/.test(rawKey.trim())) {
      this.key = Buffer.from(rawKey.trim(), 'hex');
    } else if (rawKey && rawKey.trim().length > 0) {
      this.key = crypto.createHash('sha256').update(rawKey.trim()).digest();
    } else {
      const fallbackSeed =
        this.configService?.get<string>('JWT_SECRET') ||
        process.env.JWT_SECRET ||
        'nexo-dev-token-encryption-fallback';
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn(
          'TOKEN_ENCRYPTION_KEY não configurada em produção; derivando chave a partir de JWT_SECRET. Configure TOKEN_ENCRYPTION_KEY (64 chars hex).',
        );
      }
      this.key = crypto
        .createHash('sha256')
        .update(`${fallbackSeed}:token-crypto-v1`)
        .digest();
    }
  }

  isEncrypted(value?: string | null): boolean {
    return typeof value === 'string' && value.startsWith(ENC_PREFIX);
  }

  encrypt(plaintext?: string | null): string | null {
    if (!plaintext) return null;
    if (this.isEncrypted(plaintext)) return plaintext;

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return `${ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(stored?: string | null): string | null {
    if (!stored) return null;
    // Leitura retrocompatível para tokens legados salvos em texto puro antes da migração
    if (!this.isEncrypted(stored)) {
      return stored;
    }

    const parts = stored.slice(ENC_PREFIX.length).split(':');
    if (parts.length !== 3) {
      throw new Error('Formato de token criptografado inválido');
    }

    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
