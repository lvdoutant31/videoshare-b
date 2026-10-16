import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ElementPlus, { ElPagination, ElSelect } from 'element-plus';
import VideoManagementView from './VideoManagementView.vue';
import { videoRepositoryKey } from '../features/video/repository';
import { taxonomyRepositoryKey } from '../features/taxonomy/repository';
import type { VideoQuery } from '../features/video/model';

afterEach(() => vi.unstubAllGlobals());

describe('content management pagination', () => {
  it('uses ten items per page, fetches the next page, and resets when page size or filters change', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    const requests: VideoQuery[] = [];
    const list = vi.fn(async (query: VideoQuery) => {
      requests.push({ ...query });
      return { items: [], total: 14, page: query.page, pageSize: query.pageSize };
    });
    const wrapper = mount(VideoManagementView, {
      global: {
        plugins: [ElementPlus],
        provide: { [videoRepositoryKey as symbol]: { list }, [taxonomyRepositoryKey as symbol]: {} },
        stubs: { AdminShell: { template: '<main><slot /></main>' }, VideoUploadDialog: true, RichTextEditor: true },
      },
    });
    await flushPromises();
    const pagination = wrapper.getComponent(ElPagination);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ page: 1, pageSize: 10 });
    expect(pagination.props('pageSizes')).toEqual([10, 20, 50, 100]);
    expect(pagination.props('layout')).toContain('jumper');

    await pagination.get('.btn-next').trigger('click');
    await flushPromises();
    expect(requests).toHaveLength(2);
    expect(requests[requests.length - 1]).toMatchObject({ page: 2, pageSize: 10 });

    pagination.getComponent(ElSelect).vm.$emit('change', 20);
    await flushPromises();
    expect(requests).toHaveLength(3);
    expect(requests[requests.length - 1]).toMatchObject({ page: 1, pageSize: 20 });

    pagination.getComponent(ElSelect).vm.$emit('change', 10);
    await flushPromises();
    await pagination.get('.btn-next').trigger('click');
    await flushPromises();
    const beforeSearch = requests.length;
    await wrapper.get('.filters input').setValue('培训');
    await wrapper.get('.filters input').trigger('keyup', { key: 'Enter' });
    await flushPromises();
    expect(requests).toHaveLength(beforeSearch + 1);
    expect(requests[requests.length - 1]).toMatchObject({ page: 1, pageSize: 10, keyword: '培训' });
    wrapper.unmount();
  });
});
