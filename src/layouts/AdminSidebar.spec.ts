import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import AdminSidebar from './AdminSidebar.vue';
import { authState } from '../features/auth/repository';

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/system/categories' })
}));

describe('AdminSidebar', () => {
  it('shows 分类管理 as the active category navigation item', () => {
    authState.session = { id: '1', username: 'admin', permissions: ['category:view'] };
    const wrapper = mount(AdminSidebar, {
      props: { collapsed: false },
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          ElIcon: { template: '<span><slot /></span>' }
        }
      }
    });

    expect(wrapper.get('[aria-current="page"]').text()).toContain('分类管理');
    expect(wrapper.text()).toContain('视频管理');
    expect(wrapper.text()).not.toContain('系统与存储');
  });
});
