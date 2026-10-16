import { describe, expect, it } from 'vitest';
import { createMockUserRepository } from './mockRepository';

describe('mock user repository', () => {
  it('filters and pages users', async () => {
    const repository = createMockUserRepository();
    const page = await repository.list({ page: 1, pageSize: 1, keyword: '陈' });
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({ id: '10001', status: 'NORMAL' });
  });

  it('validates temporary penalties and updates the effective status', async () => {
    const repository = createMockUserRepository();
    await expect(repository.mute('10001', { reason: '', endsAt: '2026-09-01T08:00:00.000Z' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(repository.suspend('10001', { reason: '违规上传', endsAt: '2026-08-28T07:00:00.000Z' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    const updated = await repository.suspend('10001', { reason: '违规上传', endsAt: '2026-09-01T08:00:00.000Z' });
    expect(updated).toMatchObject({ status: 'SUSPENDED', suspendUntil: '2026-09-01T08:00:00.000Z' });
    expect(updated.penalties[0]).toMatchObject({ type: 'SUSPEND', active: true });
  });

  it('requires confirmation for permanent ban and recomputes status after revoking a penalty', async () => {
    const repository = createMockUserRepository();
    await expect(repository.ban('10001', { reason: '严重违规', confirmationToken: 'expired' })).rejects.toMatchObject({ code: 'CONFIRMATION_INVALID' });
    const token = await repository.requestBanConfirmation('10001');
    const banned = await repository.ban('10001', { reason: '严重违规', confirmationToken: token });
    expect(banned.status).toBe('BANNED');

    const restored = await repository.revokePenalty('10001', banned.penalties[0].id, { reason: '复核通过' });
    expect(restored.status).toBe('NORMAL');
    await expect(repository.revokePenalty('10001', banned.penalties[0].id, { reason: '重复解除' })).rejects.toMatchObject({ code: 'PENALTY_NOT_ACTIVE' });
  });

  it('protects cancelled users and maintains WeCom binding state', async () => {
    const repository = createMockUserRepository();
    await expect(repository.mute('10005', { reason: '违规', endsAt: '2026-09-01T08:00:00.000Z' })).rejects.toMatchObject({ code: 'STATE_CONFLICT' });
    await expect(repository.unbindWeCom('10002', { reason: '无绑定' })).rejects.toMatchObject({ code: 'WECOM_NOT_BOUND' });

    const updated = await repository.unbindWeCom('10001', { reason: '账号交接' });
    expect(updated.weComBinding.bound).toBe(false);
  });
});
