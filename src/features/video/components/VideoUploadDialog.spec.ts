import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoRepository } from '../repository';
import type { TaxonomyRepository } from '../../taxonomy/model';
import VideoUploadDialog from './VideoUploadDialog.vue';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:test-video');
    static revokeObjectURL = vi.fn();
  });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const elementStubs = {
  ElDialog: {
    props: ['modelValue'],
    template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>'
  },
  ElForm: { template: '<form><slot /></form>' },
  ElFormItem: {
    props: ['error'],
    template: '<label><slot /><span v-if="error" data-testid="field-error">{{ error }}</span></label>'
  },
  ElSelect: { template: '<div><slot /></div>' },
  ElOption: true,
  ElInput: true,
  ElUpload: { template: '<div><slot /></div>' },
  ElButton: {
    props: ['disabled', 'loading'],
    template: '<button type="button" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>'
  },
  ElAlert: true,
  ElIcon: { template: '<span><slot /></span>' }
};

function fakeVideoRepository(overrides: Partial<VideoRepository> = {}): VideoRepository {
  return {
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
    get: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    submitReview: vi.fn().mockResolvedValue({}),
    publish: vi.fn().mockResolvedValue({}),
    offShelf: vi.fn().mockResolvedValue({}),
    restore: vi.fn().mockResolvedValue({}),
    retryTranscode: vi.fn().mockResolvedValue(null),
    batchOffShelf: vi.fn().mockResolvedValue({ succeededIds: [], failed: [] }),
    batchRestore: vi.fn().mockResolvedValue({ succeededIds: [], failed: [] }),
    batchDelete: vi.fn().mockResolvedValue({ succeededIds: [], failed: [] }),
    listAuthors: vi.fn().mockResolvedValue([{ id: '7', nickname: '培训组', status: 'NORMAL' }]),
    uploadDraft: vi.fn().mockResolvedValue({ id: '101' }),
    ...overrides
  };
}

function fakeTaxonomyRepository(overrides: Partial<TaxonomyRepository> = {}): TaxonomyRepository {
  return {
    listCategories: vi.fn().mockResolvedValue({
      items: [{ id: '10', name: '培训', icon: null, sort: 0, status: 'ENABLED', createdAt: '', updatedAt: '' }],
      page: 1, pageSize: 100, total: 1
    }),
    createCategory: vi.fn().mockResolvedValue({}),
    updateCategory: vi.fn().mockResolvedValue({}),
    deleteCategory: vi.fn().mockResolvedValue(undefined),
    listTags: vi.fn().mockResolvedValue({
      items: [{ id: '20', name: '安全', heatScore: 0, status: 'ENABLED', createdAt: '', updatedAt: '' }],
      page: 1, pageSize: 100, total: 1
    }),
    createTag: vi.fn().mockResolvedValue({}),
    updateTag: vi.fn().mockResolvedValue({}),
    deleteTag: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

type DialogVm = {
  contentType: 'video' | 'article' | null;
  form: {
    title: string;
    description: string;
    categoryIds: string[];
    tagIds: string[];
  };
  fieldErrors: Record<string, string>;
  handleFileChange: (uploadFile: { raw?: File }) => void;
  submit: () => Promise<void>;
};

function mountDialog(repository: VideoRepository, taxonomyRepo?: TaxonomyRepository) {
  return mount(VideoUploadDialog, {
    props: { modelValue: true, repository, taxonomyRepository: taxonomyRepo ?? fakeTaxonomyRepository() },
    global: {
      stubs: elementStubs,
      directives: { loading: {} }
    }
  });
}

function validFile() {
  return new File(['video'], 'demo.mp4', { type: 'video/mp4' });
}

function fillValidForm(vm: DialogVm) {
  vm.contentType = 'video';
  Object.assign(vm.form, {
    title: ' 安全培训 ',
    description: ' 简介 ',
    categoryIds: ['10'],
    tagIds: ['20']
  });
  vm.handleFileChange({ raw: validFile() });
}

describe('VideoUploadDialog', () => {
  it('starts with an explicit content type choice', async () => {
    const repository = fakeVideoRepository();
    const wrapper = mountDialog(repository);
    await flushPromises();
    expect(wrapper.findAll('.content-type-card')).toHaveLength(2);
    expect(wrapper.findAll('[data-testid="field-error"]')).toHaveLength(0);
    expect(repository.uploadDraft).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it.each(['<p>纯文字正文</p>', '<p><img src="/media/images/a.png"></p>'])('allows non-video content: %s', async (description) => {
    const repository = fakeVideoRepository();
    const wrapper = mountDialog(repository);
    await flushPromises();
    const vm = wrapper.vm as unknown as DialogVm;
    await wrapper.findAll('.content-type-card')[1].trigger('click');
    Object.assign(vm.form, { title: '非视频内容', description, categoryIds: ['10'], tagIds: [] });
    await flushPromises();
    await vm.submit();
    expect(repository.uploadDraft).toHaveBeenCalledWith(expect.objectContaining({ file: undefined }));
    const saved = vi.mocked(repository.uploadDraft).mock.calls[0][0].description;
    expect(saved).toContain(description.includes('<img') ? '/media/images/a.png' : '纯文字正文');
  });

  it('rejects empty paragraphs without a video', async () => {
    const repository = fakeVideoRepository();
    const wrapper = mountDialog(repository);
    await flushPromises();
    const vm = wrapper.vm as unknown as DialogVm;
    await wrapper.findAll('.content-type-card')[1].trigger('click');
    Object.assign(vm.form, { title: '空正文', description: '<p><br>&nbsp;</p>', categoryIds: ['10'], tagIds: [] });
    await flushPromises();
    await vm.submit();
    expect(repository.uploadDraft).not.toHaveBeenCalled();
    expect(vm.fieldErrors.description).toBe('请填写图文正文');
  });

  it('loads taxonomy options without offering an author selection', async () => {
    const repository = fakeVideoRepository();
    const taxonomyRepo = fakeTaxonomyRepository();
    mountDialog(repository, taxonomyRepo);
    await flushPromises();

    expect(repository.listAuthors).not.toHaveBeenCalled();
    expect(taxonomyRepo.listCategories).toHaveBeenCalledWith({ page: 1, pageSize: 100, status: 'ENABLED' });
    expect(taxonomyRepo.listTags).toHaveBeenCalledWith({ page: 1, pageSize: 100, status: 'ENABLED' });
  });

  it('caches options and does not reload on re-open', async () => {
    const repository = fakeVideoRepository();
    const taxonomyRepo = fakeTaxonomyRepository();
    const wrapper = mountDialog(repository, taxonomyRepo);
    await flushPromises();

    await wrapper.setProps({ modelValue: false });
    await wrapper.setProps({ modelValue: true });
    await flushPromises();

    expect(repository.listAuthors).not.toHaveBeenCalled();
    expect(taxonomyRepo.listCategories).toHaveBeenCalledTimes(1);
    expect(taxonomyRepo.listTags).toHaveBeenCalledTimes(1);
  });

  it('submits a valid draft, trims text, and emits close and refresh events', async () => {
    const repository = fakeVideoRepository();
    const wrapper = mountDialog(repository);
    await flushPromises();
    const vm = wrapper.vm as unknown as DialogVm;
    fillValidForm(vm);

    await vm.submit();

    expect(repository.uploadDraft).toHaveBeenCalledWith({
        title: '安全培训',
      description: '简介',
      categoryIds: ['10'],
      tagIds: ['20'],
      file: expect.any(File)
    });
    expect(wrapper.emitted('uploaded')).toHaveLength(1);
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false]);
  });

  it.each([
    ['blank title', (vm: DialogVm) => { vm.form.title = '   '; }],
    ['missing category', (vm: DialogVm) => { vm.form.categoryIds = []; }],
    ['too many categories', (vm: DialogVm) => { vm.form.categoryIds = ['1', '2', '3', '4']; }],
    ['too many tags', (vm: DialogVm) => { vm.form.tagIds = Array.from({ length: 11 }, (_, index) => String(index)); }],
    ['unsupported file', (vm: DialogVm) => { vm.handleFileChange({ raw: new File(['x'], 'demo.txt', { type: 'text/plain' }) }); }],
    ['oversized file', (vm: DialogVm) => {
      const file = validFile();
      Object.defineProperty(file, 'size', { value: 500 * 1024 * 1024 + 1 });
      vm.handleFileChange({ raw: file });
    }]
  ])('blocks %s', async (_label, makeInvalid) => {
    const repository = fakeVideoRepository();
    const wrapper = mountDialog(repository);
    await flushPromises();
    const vm = wrapper.vm as unknown as DialogVm;
    fillValidForm(vm);
    makeInvalid(vm);
    await flushPromises();

    await vm.submit();

    expect(repository.uploadDraft).not.toHaveBeenCalled();
    expect(wrapper.emitted('uploaded')).toBeUndefined();
    expect(wrapper.findAll('[data-testid="field-error"]')).toHaveLength(1);
  });

  it('shows all missing required fields beside their controls', async () => {
    const repository = fakeVideoRepository();
    const wrapper = mountDialog(repository);
    await flushPromises();
    await wrapper.findAll('.content-type-card')[1].trigger('click');

    await (wrapper.vm as unknown as DialogVm).submit();

    expect(wrapper.findAll('[data-testid="field-error"]').map((item) => item.text())).toEqual([
      '请输入视频标题',
      '请填写图文正文',
      '请选择 1–3 个分类',
    ]);
  });

  it('keeps the completed form open when upload fails', async () => {
    const repository = fakeVideoRepository({ uploadDraft: vi.fn().mockRejectedValue(new Error('保存失败')) });
    const wrapper = mountDialog(repository);
    await flushPromises();
    const vm = wrapper.vm as unknown as DialogVm;
    fillValidForm(vm);

    await vm.submit();

    expect(vm.form.title).toBe(' 安全培训 ');
    expect(wrapper.emitted('uploaded')).toBeUndefined();
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
});
