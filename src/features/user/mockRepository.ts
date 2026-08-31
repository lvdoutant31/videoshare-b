import type { ManagedUserDetail, UserPage, UserPenalty, UserPenaltyType, UserQuery, UserRepository, UserStatus } from './model';
import { UserRepositoryError } from './repository';

const now = '2026-08-28T08:00:00.000Z';
const clone = <T>(value: T): T => structuredClone(value);

function activePenaltyType(penalties: UserPenalty[]): UserPenaltyType | undefined {
  const active = penalties.filter((penalty) => penalty.active);
  if (active.some((penalty) => penalty.type === 'BAN')) return 'BAN';
  if (active.some((penalty) => penalty.type === 'SUSPEND')) return 'SUSPEND';
  if (active.some((penalty) => penalty.type === 'MUTE')) return 'MUTE';
  return undefined;
}

function statusFor(penalties: UserPenalty[]): UserStatus {
  const type = activePenaltyType(penalties);
  return type === 'BAN' ? 'BANNED' : type === 'SUSPEND' ? 'SUSPENDED' : type === 'MUTE' ? 'MUTED' : 'NORMAL';
}

function deadlineFor(penalties: UserPenalty[], type: UserPenaltyType) {
  return penalties.find((penalty) => penalty.active && penalty.type === type)?.endsAt ?? null;
}

export function createMockUserRepository(): UserRepository {
  let penaltySequence = 106;
  const issuedBanTokens = new Set<string>();
  let users: ManagedUserDetail[] = [
    {
      id: '10001', nickname: '陈思远', avatarUrl: null, maskedPhone: '138****2176', status: 'NORMAL', followerCount: 286, followingCount: 94, violationCount: 0, createdAt: '2026-04-08T02:20:00.000Z', lastLoginAt: '2026-08-28T06:40:00.000Z', muteUntil: null, suspendUntil: null,
      weComBinding: { bound: true, boundAt: '2026-04-08T02:30:00.000Z', organizationName: '华东制造中心' }, devices: { recentDeviceCount: 2, lastActiveAt: '2026-08-28T06:40:00.000Z' }, penalties: []
    },
    {
      id: '10002', nickname: '林晓雯', avatarUrl: null, maskedPhone: '139****8452', status: 'MUTED', followerCount: 98, followingCount: 216, violationCount: 2, createdAt: '2026-05-12T07:10:00.000Z', lastLoginAt: '2026-08-27T11:22:00.000Z', muteUntil: '2026-09-02T08:00:00.000Z', suspendUntil: null,
      weComBinding: { bound: false, boundAt: null, organizationName: null }, devices: { recentDeviceCount: 1, lastActiveAt: '2026-08-27T11:22:00.000Z' }, penalties: [{ id: 'penalty-101', type: 'MUTE', reason: '多次发布与主题无关的评论', startsAt: '2026-08-26T08:00:00.000Z', endsAt: '2026-09-02T08:00:00.000Z', active: true, revokedAt: null, revokedReason: null, operator: '当前管理员' }]
    },
    {
      id: '10003', nickname: '周启航', avatarUrl: null, maskedPhone: '186****3901', status: 'SUSPENDED', followerCount: 1_124, followingCount: 63, violationCount: 3, createdAt: '2026-02-24T04:00:00.000Z', lastLoginAt: '2026-08-25T02:14:00.000Z', muteUntil: null, suspendUntil: '2026-09-11T08:00:00.000Z',
      weComBinding: { bound: true, boundAt: '2026-02-24T04:12:00.000Z', organizationName: '生产管理部' }, devices: { recentDeviceCount: 3, lastActiveAt: '2026-08-25T02:14:00.000Z' }, penalties: [{ id: 'penalty-102', type: 'SUSPEND', reason: '违规发布未授权现场拍摄内容', startsAt: '2026-08-25T08:00:00.000Z', endsAt: '2026-09-11T08:00:00.000Z', active: true, revokedAt: null, revokedReason: null, operator: '王审核' }]
    },
    {
      id: '10004', nickname: '匿名用户', avatarUrl: null, maskedPhone: '137****5029', status: 'BANNED', followerCount: 14, followingCount: 12, violationCount: 6, createdAt: '2026-01-18T09:20:00.000Z', lastLoginAt: '2026-08-12T03:50:00.000Z', muteUntil: null, suspendUntil: null,
      weComBinding: { bound: false, boundAt: null, organizationName: null }, devices: { recentDeviceCount: 1, lastActiveAt: '2026-08-12T03:50:00.000Z' }, penalties: [{ id: 'penalty-103', type: 'BAN', reason: '严重违反平台内容规范', startsAt: '2026-08-13T08:00:00.000Z', endsAt: null, active: true, revokedAt: null, revokedReason: null, operator: '超级管理员' }]
    },
    {
      id: '10005', nickname: '已注销用户', avatarUrl: null, maskedPhone: null, status: 'CANCELLED', followerCount: 0, followingCount: 0, violationCount: 0, createdAt: '2026-03-16T05:00:00.000Z', lastLoginAt: null, muteUntil: null, suspendUntil: null,
      weComBinding: { bound: false, boundAt: null, organizationName: null }, devices: { recentDeviceCount: 0, lastActiveAt: null }, penalties: [{ id: 'penalty-104', type: 'MUTE', reason: '历史评论违规', startsAt: '2026-07-01T08:00:00.000Z', endsAt: '2026-07-08T08:00:00.000Z', active: false, revokedAt: null, revokedReason: null, operator: '当前管理员' }]
    },
    {
      id: '10006', nickname: '魏明', avatarUrl: null, maskedPhone: '158****6173', status: 'NORMAL', followerCount: 452, followingCount: 187, violationCount: 1, createdAt: '2026-06-18T08:00:00.000Z', lastLoginAt: '2026-08-28T05:35:00.000Z', muteUntil: null, suspendUntil: null,
      weComBinding: { bound: true, boundAt: '2026-06-18T08:08:00.000Z', organizationName: '设备管理部' }, devices: { recentDeviceCount: 2, lastActiveAt: '2026-08-28T05:35:00.000Z' }, penalties: [{ id: 'penalty-105', type: 'MUTE', reason: '重复发布广告信息', startsAt: '2026-07-10T08:00:00.000Z', endsAt: '2026-07-17T08:00:00.000Z', active: false, revokedAt: null, revokedReason: null, operator: '李审核' }]
    }
  ];

  function find(userId: string) {
    const user = users.find((item) => item.id === userId);
    if (!user) throw new UserRepositoryError('用户不存在或已不可见', { code: 'USER_NOT_FOUND' });
    return user;
  }

  function replace(user: ManagedUserDetail) {
    users = users.map((item) => item.id === user.id ? user : item);
    return clone(user);
  }

  function ensureMutable(user: ManagedUserDetail) {
    if (user.status === 'CANCELLED') throw new UserRepositoryError('已注销用户不能执行治理操作', { code: 'STATE_CONFLICT' });
  }

  function validateReason(reason: string) {
    if (!reason.trim()) throw new UserRepositoryError('请填写处理原因', { code: 'VALIDATION_FAILED' });
  }

  function validateEndsAt(endsAt: string) {
    if (!endsAt || Number.isNaN(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(now)) {
      throw new UserRepositoryError('截止时间必须晚于当前时间', { code: 'VALIDATION_FAILED' });
    }
  }

  function applyPenalty(user: ManagedUserDetail, type: UserPenaltyType, reason: string, endsAt: string | null) {
    const penalty: UserPenalty = { id: `penalty-${penaltySequence++}`, type, reason: reason.trim(), startsAt: now, endsAt, active: true, revokedAt: null, revokedReason: null, operator: '当前管理员' };
    const penalties = [penalty, ...user.penalties];
    const status = statusFor(penalties);
    return { ...user, status, muteUntil: deadlineFor(penalties, 'MUTE'), suspendUntil: deadlineFor(penalties, 'SUSPEND'), violationCount: user.violationCount + 1, penalties };
  }

  return {
    async list(query): Promise<UserPage> {
      const keyword = query.keyword?.trim();
      const matched = users.filter((user) => (!keyword || `${user.id}${user.nickname}${user.maskedPhone ?? ''}`.includes(keyword)) && (!query.status || user.status === query.status));
      const start = (query.page - 1) * query.pageSize;
      return { items: clone(matched.slice(start, start + query.pageSize).map(({ weComBinding, devices, penalties, ...item }) => item)), page: query.page, pageSize: query.pageSize, total: matched.length };
    },
    async get(userId) { return clone(find(userId)); },
    async mute(userId, input) {
      const user = find(userId); ensureMutable(user); validateReason(input.reason); validateEndsAt(input.endsAt);
      if (user.status === 'MUTED') throw new UserRepositoryError('用户当前已处于禁言状态', { code: 'STATE_CONFLICT' });
      if (user.status === 'SUSPENDED' || user.status === 'BANNED') throw new UserRepositoryError('当前状态不允许新增禁言处罚', { code: 'STATE_CONFLICT' });
      return replace(applyPenalty(user, 'MUTE', input.reason, input.endsAt));
    },
    async suspend(userId, input) {
      const user = find(userId); ensureMutable(user); validateReason(input.reason); validateEndsAt(input.endsAt);
      if (user.status === 'SUSPENDED' || user.status === 'BANNED') throw new UserRepositoryError('用户当前已处于封禁状态', { code: 'STATE_CONFLICT' });
      return replace(applyPenalty(user, 'SUSPEND', input.reason, input.endsAt));
    },
    async requestBanConfirmation(userId) {
      const user = find(userId);
      ensureMutable(user);
      const token = `mock-confirm-user-ban-${userId}-${penaltySequence}`;
      issuedBanTokens.add(token);
      return token;
    },
    async ban(userId, input) {
      const user = find(userId); ensureMutable(user); validateReason(input.reason);
      if (!issuedBanTokens.delete(input.confirmationToken)) throw new UserRepositoryError('永久封禁确认已失效，请重新确认', { code: 'CONFIRMATION_INVALID' });
      if (user.status === 'BANNED') throw new UserRepositoryError('用户当前已被永久封禁', { code: 'STATE_CONFLICT' });
      return replace(applyPenalty(user, 'BAN', input.reason, null));
    },
    async revokePenalty(userId, penaltyId, input) {
      const user = find(userId); ensureMutable(user); validateReason(input.reason);
      const penalty = user.penalties.find((item) => item.id === penaltyId);
      if (!penalty?.active) throw new UserRepositoryError('处罚已解除或不存在', { code: 'PENALTY_NOT_ACTIVE' });
      const penalties = user.penalties.map((item) => item.id === penaltyId ? { ...item, active: false, revokedAt: now, revokedReason: input.reason.trim() } : item);
      const status = statusFor(penalties);
      return replace({ ...user, status, muteUntil: deadlineFor(penalties, 'MUTE'), suspendUntil: deadlineFor(penalties, 'SUSPEND'), penalties });
    },
    async unbindWeCom(userId, input) {
      const user = find(userId); ensureMutable(user); validateReason(input.reason);
      if (!user.weComBinding.bound) throw new UserRepositoryError('用户当前未绑定企微身份', { code: 'WECOM_NOT_BOUND' });
      return replace({ ...user, weComBinding: { bound: false, boundAt: null, organizationName: null } });
    }
  };
}
