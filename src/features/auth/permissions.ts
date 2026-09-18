import { authState } from './repository';

export function hasPermission(permission?: string): boolean {
  if (!permission) return true;
  return authState.session?.permissions.includes(permission) ?? false;
}
