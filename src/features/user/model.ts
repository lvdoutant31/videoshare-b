export type UserStatus = 'NORMAL' | 'MUTED' | 'SUSPENDED' | 'BANNED' | 'CANCELLED';
export type UserPenaltyType = 'MUTE' | 'SUSPEND' | 'BAN';

export interface UserQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: UserStatus;
}

export interface ManagedUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  maskedPhone: string | null;
  status: UserStatus;
  followerCount: number;
  followingCount: number;
  violationCount: number;
  createdAt: string;
  lastLoginAt: string | null;
  muteUntil: string | null;
  suspendUntil: string | null;
}

export interface WeComBindingSummary {
  bound: boolean;
  boundAt: string | null;
  organizationName: string | null;
}

export interface DeviceSummary {
  recentDeviceCount: number;
  lastActiveAt: string | null;
}

export interface UserPenalty {
  id: string;
  type: UserPenaltyType;
  reason: string;
  startsAt: string;
  endsAt: string | null;
  active: boolean;
  revokedAt: string | null;
  revokedReason: string | null;
  operator: string;
}

export interface ManagedUserDetail extends ManagedUser {
  weComBinding: WeComBindingSummary;
  devices: DeviceSummary;
  penalties: UserPenalty[];
}

export interface UserPage {
  items: ManagedUser[];
  page: number;
  pageSize: number;
  total: number;
}

export interface TemporaryPenaltyInput {
  reason: string;
  endsAt: string;
}

export interface BanUserInput {
  reason: string;
  confirmationToken: string;
}

export interface ReasonInput {
  reason: string;
}

export interface UserRepository {
  list(query: UserQuery): Promise<UserPage>;
  get(userId: string): Promise<ManagedUserDetail>;
  mute(userId: string, input: TemporaryPenaltyInput): Promise<ManagedUserDetail>;
  suspend(userId: string, input: TemporaryPenaltyInput): Promise<ManagedUserDetail>;
  requestBanConfirmation(userId: string): Promise<string>;
  ban(userId: string, input: BanUserInput): Promise<ManagedUserDetail>;
  revokePenalty(userId: string, penaltyId: string, input: ReasonInput): Promise<ManagedUserDetail>;
  unbindWeCom(userId: string, input: ReasonInput): Promise<ManagedUserDetail>;
}

export const userStatusLabel: Record<UserStatus, string> = {
  NORMAL: '正常',
  MUTED: '禁言中',
  SUSPENDED: '临时封禁',
  BANNED: '永久封禁',
  CANCELLED: '已注销'
};

export const userPenaltyLabel: Record<UserPenaltyType, string> = {
  MUTE: '禁言',
  SUSPEND: '临时封禁',
  BAN: '永久封禁'
};
