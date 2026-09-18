import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminRepository } from '../features/admin/model';
import { adminRepositoryKey } from '../features/admin/repository';
import AdminManagementPanel from './AdminManagementPanel.vue';
import { authState } from '../features/auth/repository';

describe('AdminManagementPanel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    authState.session = null;
  });

  it('only opens an admin dialog after an explicit action', async () => {
    authState.session = { id: '1', username: 'admin', permissions: ['admin:view', 'admin:create'] };
    const repository = {
      list: vi.fn().mockResolvedValue({ items: [], total: 0 })
    } as unknown as AdminRepository;
    const wrapper = mount(AdminManagementPanel, {
      attachTo: document.body,
      global: {
        plugins: [ElementPlus],
        provide: { [adminRepositoryKey as symbol]: repository }
      }
    });

    await flushPromises();
    expect(document.querySelector('.el-dialog')).toBeNull();

    const createButton = wrapper.findAll('button').find((button) => button.text() === '新建管理员');
    expect(createButton).toBeDefined();
    await createButton!.trigger('click');
    await flushPromises();

    expect(document.body.textContent).toContain('初始密码');
    wrapper.unmount();
  });

  it('hides mutation controls from an admin viewer', async () => {
    authState.session = { id: '1', username: 'viewer', permissions: ['admin:view'] };
    const repository = {
      list: vi.fn().mockResolvedValue({
        items: [{ id: '2', username: 'operator', status: 'NORMAL', roleCodes: [], lastLoginAt: null, createdAt: null }],
        total: 1
      })
    } as unknown as AdminRepository;
    const wrapper = mount(AdminManagementPanel, {
      global: { plugins: [ElementPlus], provide: { [adminRepositoryKey as symbol]: repository } }
    });

    await flushPromises();
    expect(wrapper.text()).not.toContain('新建管理员');
    expect(wrapper.text()).not.toContain('重置密码');
    expect(wrapper.text()).not.toContain('停用');
  });
});
