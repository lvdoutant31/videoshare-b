import { afterEach, describe, expect, it } from 'vitest';
import { authState } from './repository';
import { hasPermission } from './permissions';

describe('admin permissions', () => {
  afterEach(() => { authState.session = null; });

  it('checks operation permissions independently from module visibility', () => {
    authState.session = { id: '1', username: 'admin', permissions: ['admin:view'] };
    expect(hasPermission('admin:view')).toBe(true);
    expect(hasPermission('user:view')).toBe(false);
  });
});
