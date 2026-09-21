import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { describe, expect, it } from 'vitest';
import CommentReportManagementView from './CommentReportManagementView.vue';
import { createMockCommentReportRepository } from '../features/comment-report/mockRepository';
import { commentReportRepositoryKey } from '../features/comment-report/repository';

function mountView(resource: 'comments' | 'reports') {
  return mount(CommentReportManagementView, {
    props: { resource },
    global: {
      plugins: [ElementPlus],
      provide: { [commentReportRepositoryKey as symbol]: createMockCommentReportRepository() },
      stubs: { AdminShell: { template: '<main><slot /></main>' } }
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
  });

  it('loads the report handling queue', async () => {
    const wrapper = mountView('reports');
    await flushPromises();
    expect(wrapper.text()).toContain('举报处置');
    expect(wrapper.text()).toContain('人身攻击或不友善内容');
  });
});
