import type { AdminAppAccount } from '../auth/repository';

export type AdminStatus = 'NORMAL' | 'DISABLED';

export interface AdminRole {
  code: string;
  name: string;
}

export interface AdminPermission {
  code: string;
  name: string;
}

export interface AdminUser {
  id: string;
  username: string;
  status: AdminStatus;
  roleCodes: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUser {
  roles: AdminRole[];
}

export interface AdminUserPage {
  items: AdminUser[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminUserQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: AdminStatus;
}

export interface CreateAdminInput {
  username: string;
  password: string;
}

export interface AdminRepository {
  list(query: AdminUserQuery): Promise<AdminUserPage>;
  get(adminId: string): Promise<AdminUserDetail>;
  create(input: CreateAdminInput): Promise<AdminUserDetail>;
  resetPassword(adminId: string, newPassword: string): Promise<void>;
  updateStatus(adminId: string, status: AdminStatus): Promise<AdminUserDetail>;
  listRoles(): Promise<AdminRole[]>;
  listPermissions(): Promise<AdminPermission[]>;
  getPermissions(adminId: string): Promise<string[]>;
  updatePermissions(adminId: string, permissionCodes: string[]): Promise<string[]>;
  getAppAccount(adminId: string): Promise<AdminAppAccount>;
  bindAppAccount(adminId: string, phone: string, password: string): Promise<AdminAppAccount>;
}

export const adminStatusLabel: Record<AdminStatus, string> = {
  NORMAL: '正常',
  DISABLED: '已停用'
};
