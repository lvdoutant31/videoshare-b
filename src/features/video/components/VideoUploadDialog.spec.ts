import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { VideoRepository } from '../repository';
import VideoUploadDialog from './VideoUploadDialog.vue';

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

function fakeRepository(overrides: Partial<VideoRepository> = {}): VideoRepository {
  return {
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
    get: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    submitReview: vi.fn().mockResolvedValue({}),
    offShelf: vi.fn().mockResolvedValue({}),
    restore: vi.fn().mockResolvedValue({}),
    retryTranscode: vi.fn().mockResolvedValue(null),
    batchOffShelf: vi.fn().mockResolvedValue({ succeededIds: [], failed: [] }),
    batchRestore: vi.fn().mockResolvedValue({ succeededIds: [], failed: [] }),
    createSimulatedUpload: vi.fn().mockResolvedValue({}),
    listAuthors: vi.fn().mockResolvedValue([{ id: '7', nickname: '培训组', status: 'NORMAL' }]),
    listCategories: vi.fn().mockResolvedValue([{ id: '10', name: '培训', status: 'NORMAL' }]),
    listTags: vi.fn().mockResolvedValue([{ id: '20', name: '安全', status: 'NORMAL' }]),
    uploadDraft: vi.fn().mockResolvedValue({ id: '101' }),
    ...overrides
  };
}

type DialogVm = {
  form: {
    authorId: string;
    title: string;
    description: string;
    categoryIds: string[];
    tagIds: string[];
  };
  fieldErrors: Record<string, string>;
  handleFileChange: (uploadFile: { raw?: File }) => void;
  submit: () => Promise<void>;
};

function mountDialog(repository: VideoRepository) {
  return mount(VideoUploadDialog, {
    props: { modelValue: true, repository },
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
  Object.assign(vm.form, {
    authorId: '7',
    title: ' 安全培训 ',
    description: ' 简介 ',
    categoryIds: ['10'],
    tagIds: ['20']
  });
  vm.handleFileChange({ raw: validFile() });
}

describe('VideoUploadDialog', () => {
  it('loads author, category, and tag options only once after a successful load', async () => {
    const repository = fakeRepository();
    const wrapper = mountDialog(repository);
    await flushPromises();

    await wrapper.setProps({ modelValue: false });
    await wrapper.setProps({ modelValue: true });
    await flushPromises();

    expect(repository.listAuthors).toHaveBeenCalledTimes(1);
    expect(repository.listCategories).toHaveBeenCalledTimes(1);
    expect(repository.listTags).toHaveBeenCalledTimes(1);
  });

  it('submits a valid draft, trims text, and emits close and refresh events', async () => {
    const repository = fakeRepository();
    const wrapper = mountDialog(repository);
    await flushPromises();
    const vm = wrapper.vm as unknown as DialogVm;
    fillValidForm(vm);

    await vm.submit();

    expect(repository.uploadDraft).toHaveBeenCalledWith({
      authorId: '7',
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
    ['empty author', (vm: DialogVm) => { vm.form.authorId = ''; }],
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
    const repository = fakeRepository();
    const wrapper = mountDialog(repository);
    await flushPromises();
    const vm = wrapper.vm as unknown as DialogVm;
    fillValidForm(vm);
    makeInvalid(vm);

    await vm.submit();

    expect(repository.uploadDraft).not.toHaveBeenCalled();
    expect(wrapper.emitted('uploaded')).toBeUndefined();
    expect(wrapper.findAll('[data-testid="field-error"]')).toHaveLength(1);
  });

  it('shows all missing required fields beside their controls', async () => {
    const repository = fakeRepository();
    const wrapper = mountDialog(repository);
    await flushPromises();

    await (wrapper.vm as unknown as DialogVm).submit();

    expect(wrapper.findAll('[data-testid="field-error"]').map((item) => item.text())).toEqual([
      '请选择作者',
      '请输入视频标题',
      '请选择 1–3 个分类',
      '请选择视频文件'
    ]);
  });

  it('keeps the completed form open when upload fails', async () => {
    const repository = fakeRepository({ uploadDraft: vi.fn().mockRejectedValue(new Error('保存失败')) });
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
