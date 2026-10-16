import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { describe, expect, it, vi } from 'vitest';
import type { TaxonomyRepository } from '../features/taxonomy/model';
import { taxonomyRepositoryKey } from '../features/taxonomy/repository';
import TaxonomyManagementView from './TaxonomyManagementView.vue';

describe('TaxonomyManagementView', () => {
  it('loads the matching resource when the reused route changes', async () => {
    const emptyPage = { items: [], page: 1, pageSize: 20, total: 0 };
    const repository: TaxonomyRepository = {
      listCategories: vi.fn().mockResolvedValue(emptyPage),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      listTags: vi.fn().mockResolvedValue(emptyPage),
      createTag: vi.fn(),
      updateTag: vi.fn(),
      deleteTag: vi.fn()
    };

    const wrapper = mount(TaxonomyManagementView, {
      props: { resource: 'categories' },
      global: {
        plugins: [ElementPlus],
        provide: { [taxonomyRepositoryKey as symbol]: repository },
        stubs: { AdminShell: { template: '<main><slot /></main>' } }
      }
    });

    await flushPromises();
    expect(repository.listCategories).toHaveBeenCalledOnce();

    await wrapper.setProps({ resource: 'tags' });
    await flushPromises();

    expect(repository.listTags).toHaveBeenCalledOnce();
  });
});
