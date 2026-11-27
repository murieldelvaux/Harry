import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import axios from 'axios';
import { NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { TokenCryptoService } from '../common/crypto/token-crypto.service';
import { ShoppingListService } from '../modules/shopping-list/shopping-list.service';
import { CalendarService } from '../modules/calendar/calendar.service';
import { WhatsappService } from '../modules/whatsapp/whatsapp.service';
import { DailyBriefingService } from '../modules/calendar/daily-briefing.service';
import { AuthService } from '../modules/auth/auth.service';
import { RecordScope } from '../../../packages/shared/src';

describe('TokenCryptoService', () => {
  const cryptoSvc = new TokenCryptoService({
    get: (k: string) =>
      k === 'TOKEN_ENCRYPTION_KEY'
        ? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        : undefined,
  } as any);

  it('encrypts and decrypts OAuth tokens using AES-256-GCM', () => {
    const plain = 'ya29.sample-google-access-token';
    const enc = cryptoSvc.encrypt(plain)!;
    assert.ok(enc.startsWith('enc:v1:'));
    assert.notEqual(enc, plain);
    assert.equal(cryptoSvc.decrypt(enc), plain);
  });

  it('reads legacy plaintext tokens for backwards compatibility', () => {
    assert.equal(cryptoSvc.decrypt('legacy-plain-token'), 'legacy-plain-token');
  });

  it('throws when encrypted payload is tampered', () => {
    const enc = cryptoSvc.encrypt('secret-token')!;
    const tampered = enc.slice(0, -4) + 'AAAA';
    assert.throws(() => cryptoSvc.decrypt(tampered));
  });
});

describe('ShoppingListService — scope integrity & IDOR protection', () => {
  function makeService(items: Record<string, any>, users: Record<string, any>) {
    const emitted: any[] = [];
    const prisma: any = {
      shoppingItem: {
        findUnique: async ({ where }: any) => items[where.id] || null,
        update: async ({ where, data }: any) => {
          items[where.id] = { ...items[where.id], ...data, updatedAt: new Date() };
          return items[where.id];
        },
        delete: async ({ where }: any) => {
          delete items[where.id];
          return { id: where.id };
        },
        create: async ({ data }: any) => {
          const id = 'new-' + Math.random().toString(36).slice(2, 8);
          items[id] = { id, ...data, isCompleted: false, createdAt: new Date(), updatedAt: new Date() };
          return items[id];
        },
      },
      user: {
        findUnique: async ({ where }: any) => users[where.id] || null,
      },
    };
    const realtime: any = { emit: (ev: any) => emitted.push(ev) };
    const aiParser: any = {
      parseMessage: async () => ({ data: { items: [{ name: 'Café', quantity: '1', category: 'Geral' }] } }),
    };
    const notifications: any = { notifyHouseholdPartners: async () => [] };
    const service = new ShoppingListService(prisma, aiParser, realtime, notifications);
    return { service, items, emitted };
  }

  it('syncs householdId when moving item from PRIVATE to SHARED and emits SSE', async () => {
    const { service, items, emitted } = makeService(
      {
        item1: {
          id: 'item1',
          name: 'Leite',
          scope: RecordScope.PRIVATE,
          userId: 'user-a',
          householdId: null,
          isCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { 'user-a': { id: 'user-a', householdId: 'hh-1' } },
    );

    const updated = await service.update('user-a', 'item1', { scope: RecordScope.SHARED });
    assert.equal(updated.scope, RecordScope.SHARED);
    assert.equal(updated.householdId, 'hh-1');
    assert.equal(items.item1.householdId, 'hh-1');
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].type, 'SHOPPING_UPDATED');
  });

  it('detaches householdId when moving item from SHARED to PRIVATE', async () => {
    const { service } = makeService(
      {
        item1: {
          id: 'item1',
          name: 'Ovos',
          scope: RecordScope.SHARED,
          userId: 'user-a',
          householdId: 'hh-1',
          isCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { 'user-a': { id: 'user-a', householdId: 'hh-1' } },
    );

    const updated = await service.update('user-a', 'item1', { scope: RecordScope.PRIVATE });
    assert.equal(updated.scope, RecordScope.PRIVATE);
    assert.equal(updated.householdId, null);
  });

  it('blocks partner from editing or deleting another user PRIVATE item (IDOR)', async () => {
    const { service } = makeService(
      {
        priv1: {
          id: 'priv1',
          name: 'Presente surpresa',
          scope: RecordScope.PRIVATE,
          userId: 'user-a',
          householdId: null,
          isCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      {
        'user-a': { id: 'user-a', householdId: 'hh-1' },
        'user-b': { id: 'user-b', householdId: 'hh-1' },
      },
    );

    await assert.rejects(
      () => service.update('user-b', 'priv1', { name: 'Hack' }),
      NotFoundException,
    );
    await assert.rejects(() => service.toggleComplete('user-b', 'priv1'), NotFoundException);
    await assert.rejects(() => service.delete('user-b', 'priv1'), NotFoundException);
  });

  it('respects explicit PRIVATE scope during importSpreadsheet even when user has householdId', async () => {
    const { service } = makeService({}, { 'user-a': { id: 'user-a', householdId: 'hh-1' } });
    const res = await service.importSpreadsheet('user-a', {
      text: 'Café',
      scope: RecordScope.PRIVATE,
    });
    assert.equal(res.count, 1);
    assert.equal(res.items[0].scope, RecordScope.PRIVATE);
    assert.equal(res.items[0].householdId, null);
  });

  it('rejects moving item to SHARED when user has no householdId', async () => {
    const { service } = makeService(
      {
        item1: {
          id: 'item1',
          name: 'Pão',
          scope: RecordScope.PRIVATE,
          userId: 'solo',
          householdId: null,
          isCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { solo: { id: 'solo', householdId: null } },
    );

    await assert.rejects(
      () => service.update('solo', 'item1', { scope: RecordScope.SHARED }),
      BadRequestException,
    );
  });
});

describe('WhatsappService & DailyBriefingService — template sanitization & no duplication', () => {
  it('sanitizes newlines, tabs, and repeated spaces to prevent Meta #132018', () => {
    const wa = new WhatsappService(
      {} as any,
      {} as any,
      { get: () => undefined } as any,
      { emit: () => {} } as any,
    );
    const sanitized = wa.sanitizeTemplateParam('• 09:00 - Reunião\n\t• 14:00     Dentista');
    assert.equal(sanitized.includes('\n'), false);
    assert.equal(sanitized.includes('\t'), false);
    assert.equal(/\s{2,}/.test(sanitized), false);
    assert.ok(sanitized.includes('09:00 - Reunião'));
  });

  it('returns delivered=false when WHATSAPP_ACCESS_TOKEN is not configured (no hardcoded fallback)', async () => {
    const wa = new WhatsappService(
      {} as any,
      {} as any,
      { get: () => undefined } as any,
      { emit: () => {} } as any,
    );
    const res = await wa.sendWhatsAppMessage('5511999999999', 'Olá');
    assert.equal(res.delivered, false);
    assert.equal(res.errorCode, 'MISSING_CONFIG');
  });

  it('dispatches DailyBriefing once via WhatsApp and sets skipWhatsapp=true on in-app notification', async () => {
    let waCalls = 0;
    let notifParams: any = null;
    const prisma: any = {
      calendarEvent: { findMany: async () => [] },
      task: { findMany: async () => [] },
      shoppingItem: { findMany: async () => [], count: async () => 0 },
      user: {
        findUnique: async () => ({
          id: 'u1',
          name: 'Muriel',
          phoneNumber: '5511999999999',
          householdId: 'hh-1',
          timezone: 'America/Sao_Paulo',
        }),
        update: async () => ({}),
      },
    };
    const wa: any = {
      sendDailyBriefing: async () => {
        waCalls += 1;
        return { delivered: true, messageId: 'wamid.123', usedTemplate: true };
      },
    };
    const notif: any = {
      dispatchNotification: async (p: any) => {
        notifParams = p;
      },
    };
    const briefing = new DailyBriefingService(prisma, wa, notif);
    await (briefing as any).sendDailyBriefing(
      { id: 'u1', name: 'Muriel', phoneNumber: '5511999999999', householdId: 'hh-1', timezone: 'America/Sao_Paulo' },
      '2026-11-27',
    );
    assert.equal(waCalls, 1);
    assert.equal(notifParams.skipWhatsapp, true);
  });
});

describe('CalendarService — webhook auth & scope sync', () => {
  it('rejects Google Calendar webhook without valid secret (401)', async () => {
    const prisma: any = {
      googleCalendarSyncState: {
        findFirst: async () => ({
          id: 's1',
          userId: 'u1',
          calendarId: 'primary',
          channelId: 'ch-1',
          webhookSecret: 'expected-secret-hex',
        }),
      },
    };
    const svc = new CalendarService(prisma, { emit: () => {} } as any, {} as any, {
      getValidGoogleAccessToken: async () => null,
    } as any);

    await assert.rejects(
      () =>
        svc.handlePushNotification({
          'x-goog-resource-state': 'exists',
          'x-goog-channel-id': 'ch-1',
          'x-goog-channel-token': 'userId=u1&calendarId=primary&secret=wrong-secret',
        }),
      UnauthorizedException,
    );
  });

  it('syncs householdId when updating calendar event scope', async () => {
    let savedData: any = null;
    const prisma: any = {
      calendarEvent: {
        findUnique: async () => ({
          id: 'ev1',
          title: 'Dentista',
          userId: 'u1',
          householdId: null,
          scope: RecordScope.PRIVATE,
          startDate: new Date(),
          endDate: null,
          isAllDay: false,
          location: null,
          attendees: null,
          googleEventId: null,
          googleCalendarId: 'primary',
        }),
        update: async ({ data }: any) => {
          savedData = data;
          return { id: 'ev1', ...data };
        },
      },
      user: { findUnique: async () => ({ id: 'u1', householdId: 'hh-1' }) },
    };
    const svc = new CalendarService(prisma, { emit: () => {} } as any, {} as any, {
      getValidGoogleAccessToken: async () => null,
    } as any);

    await svc.update('u1', 'ev1', { scope: RecordScope.SHARED });
    assert.equal(savedData.scope, RecordScope.SHARED);
    assert.equal(savedData.householdId, 'hh-1');
  });
});

describe('AuthService — encrypted Google tokens & no token leakage', () => {
  it('never exposes googleAccessToken in getProfile and returns hasGoogleConnected', async () => {
    const cryptoSvc = new TokenCryptoService();
    const prisma: any = {
      user: {
        findUnique: async () => ({
          id: 'u1',
          email: 'm@example.com',
          name: 'Muriel',
          phoneNumber: null,
          householdId: null,
          avatarUrl: null,
          googleAccessToken: cryptoSvc.encrypt('ya29.secret'),
          googleRefreshToken: cryptoSvc.encrypt('1//refresh'),
          sharePrivateExpenses: false,
          household: null,
        }),
      },
    };
    const auth = new AuthService(
      prisma,
      {} as any,
      { get: () => undefined } as any,
      {} as any,
      {} as any,
      cryptoSvc,
    );
    const profile: any = await auth.getProfile('u1');
    assert.equal(profile.hasGoogleConnected, true);
    assert.equal('googleAccessToken' in profile, false);
    assert.equal('googleRefreshToken' in profile, false);
  });

  it('clears Google tokens on invalid_grant without failing Nexo session', async () => {
    const cryptoSvc = new TokenCryptoService();
    let cleared = false;
    const prisma: any = {
      user: {
        findUnique: async () => ({
          id: 'u1',
          googleAccessToken: cryptoSvc.encrypt('ya29.expired'),
          googleRefreshToken: cryptoSvc.encrypt('1//revoked'),
          googleTokenExpiresAt: new Date(Date.now() - 60_000),
        }),
        update: async ({ data }: any) => {
          if (data.googleAccessToken === null && data.googleRefreshToken === null) {
            cleared = true;
          }
          return data;
        },
      },
    };
    const origPost = axios.post;
    (axios as any).post = async () => {
      const err: any = new Error('invalid_grant');
      err.response = { status: 400, data: { error: 'invalid_grant' } };
      throw err;
    };
    try {
      const auth = new AuthService(
        prisma,
        {} as any,
        {
          get: (k: string) =>
            k === 'GOOGLE_CLIENT_ID'
              ? 'cid'
              : k === 'GOOGLE_CLIENT_SECRET'
                ? 'csec'
                : undefined,
        } as any,
        {} as any,
        {} as any,
        cryptoSvc,
      );
      const token = await auth.getValidGoogleAccessToken('u1');
      assert.equal(token, null);
      assert.equal(cleared, true);
    } finally {
      (axios as any).post = origPost;
    }
  });
});
