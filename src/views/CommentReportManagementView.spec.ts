import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CommentReportManagementView from './CommentReportManagementView.vue';
import { createMockCommentReportRepository } from '../features/comment-report/mockRepository';
import { commentReportRepositoryKey } from '../features/comment-report/repository';
import { authState } from '../features/auth/repository';

enableAutoUnmount(afterEach);
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => { authState.session = null; vi.unstubAllGlobals(); });

function mountView(resource: 'comments' | 'reports') {
  return mount(CommentReportManagementView, {
    props: { resource },
    global: {
      plugins: [ElementPlus],
      provide: { [commentReportRepositoryKey as symbol]: createMockCommentReportRepository() },
      stubs: {
        AdminShell: { template: '<main><slot /></main>' },
        ElDrawer: { props: ['modelValue'], template: '<section v-if="modelValue"><slot /></section>' },
        ElDialog: { props: ['modelValue'], template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>' },
      }
    }
  });
}

describe('CommentReportManagementView', () => {
  it('loads the comment management queue', async () => {
    const wrapper = mountView('comments');
    await flushPromises();
    expect(wrapper.text()).toContain('评论管理');
    expect(wrapper.text()).toContain('这类内容没有实际帮助。');
    expect(wrapper.text()).toContain('车间安全巡检规范');
    expect(wrapper.text()).toContain('所属视频');
  });

  it('loads the report handling queue', async () => {
    const wrapper = mountView('reports');
    await flushPromises();
    expect(wrapper.text()).toContain('举报管理');
    expect(wrapper.text()).toContain('人身攻击或不友善内容');
  });

  it('shows decisions after the logged-in administrator claims the report and records a rejection', async () => {
    authState.session = { id: '7', username: 'admin', permissions: ['report:view', 'report:claim', 'report:resolve', 'report:reject'] };
    const wrapper = mountView('reports');
    const clickButton = async (name: string) => {
      const button = wrapper.findAll('button').find(item => item.text() === name);
      expect(button, `${name} button`).toBeDefined();
      await button!.trigger('click');
      await flushPromises();
    };
    await flushPromises();
    await wrapper.findAll('.el-table__row')[0]!.find('button').trigger('click');
    await flushPromises();
    await clickButton('领取举报');
    expect(wrapper.text()).toContain('解决举报');
    expect(wrapper.text()).toContain('驳回举报');
    await clickButton('驳回举报');
    await wrapper.get('textarea').setValue('证据不足');
    await clickButton('确认提交');
    expect(wrapper.text()).toContain('已驳回');
    expect(wrapper.text()).toContain('证据不足');
    wrapper.unmount();
  });
});
