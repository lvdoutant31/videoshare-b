import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { describe, expect, it } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';
import UserManagementView from './UserManagementView.vue';
import { createMockUserRepository } from '../features/user/mockRepository';
import { userRepositoryKey } from '../features/user/repository';

describe('UserManagementView', () => {
  it('loads users and presents a read-only cancelled user detail', async () => {
    const router = createRouter({ history: createWebHistory(), routes: [{ path: '/', component: UserManagementView }, { path: '/login', component: { template: '<div>登录</div>' } }] });
    await router.push('/');
    await router.isReady();
    const wrapper = mount(UserManagementView, {
      global: {
        plugins: [ElementPlus, router],
        provide: { [userRepositoryKey as symbol]: createMockUserRepository() },
        stubs: { AdminShell: { template: '<main><slot /></main>' } }
      }
    });

    await flushPromises();
    expect(wrapper.text()).toContain('陈思远');
    expect(wrapper.text()).toContain('已注销用户');

    const viewButtons = wrapper.findAll('button').filter((button) => button.text() === '查看');
    await viewButtons[4].trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('已注销用户仅可查看历史信息。');
    expect(wrapper.text()).not.toContain('永久封禁确认令牌接口尚未完成对接');
  });
});
