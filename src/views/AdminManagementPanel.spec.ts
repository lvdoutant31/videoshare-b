import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminRepository } from '../features/admin/model';
import { adminRepositoryKey } from '../features/admin/repository';
import AdminManagementPanel from './AdminManagementPanel.vue';

describe('AdminManagementPanel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('only opens an admin dialog after an explicit action', async () => {
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
});
