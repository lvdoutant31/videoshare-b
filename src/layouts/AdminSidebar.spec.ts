import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminSidebar from './AdminSidebar.vue';
import { authState } from '../features/auth/repository';

const route = vi.hoisted(() => ({ path: '/system/categories' }));
vi.mock('vue-router', () => ({ useRoute: () => route }));
enableAutoUnmount(afterEach);
afterEach(() => { authState.session = null; route.path = '/system/categories'; });

function mountNavigation(permissions: string[], path: string, collapsed = false) {
  authState.session = { id: '1', username: 'admin', permissions };
  route.path = path;
  return mount(AdminSidebar, {
    props: { collapsed },
    global: { stubs: {
      RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      ElIcon: { template: '<span><slot /></span>' }
    } }
  });
}

describe('AdminSidebar', () => {
  it('shows 分类管理 as the active category navigation item', () => {
    authState.session = { id: '1', username: 'admin', permissions: ['category:view', 'video:view'] };
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
    expect(wrapper.text()).toContain('内容管理');
    expect(wrapper.text()).not.toContain('系统与存储');
  });

  it('links report-only administrators directly to the report queue', () => {
    const wrapper = mountNavigation(['report:view'], '/reports');
    expect(wrapper.get('a[href="/reports"]').text()).toBe('举报管理');
    expect(wrapper.get('[aria-current="page"]').attributes('href')).toBe('/reports');
    expect(wrapper.find('a[href="/comments"]').exists()).toBe(false);
  });

  it('does not expose report navigation to comment-only administrators', () => {
    const wrapper = mountNavigation(['comment:view'], '/comments');
    expect(wrapper.get('a[href="/comments"]').text()).toBe('评论管理');
    expect(wrapper.find('a[href="/reports"]').exists()).toBe(false);
  });

  it('shows both destinations and highlights only the current queue', () => {
    const wrapper = mountNavigation(['comment:view', 'report:view'], '/reports');
    expect(wrapper.findAll('a')).toHaveLength(2);
    expect(wrapper.findAll('[aria-current="page"]')).toHaveLength(1);
    expect(wrapper.get('[aria-current="page"]').text()).toBe('举报管理');
    expect(wrapper.get('a[href="/comments"]').classes()).not.toContain('nav-item--active');
  });

  it('hides both queues without their permissions', () => {
    const wrapper = mountNavigation(['dashboard:view'], '/dashboard');
    expect(wrapper.find('a[href="/reports"]').exists()).toBe(false);
    expect(wrapper.find('a[href="/comments"]').exists()).toBe(false);
  });

  it('keeps the report link accessible when the sidebar is collapsed', () => {
    const wrapper = mountNavigation(['report:view'], '/reports', true);
    expect(wrapper.get('a[href="/reports"]').attributes('aria-label')).toBe('举报管理');
  });
});
