<script setup lang="ts">
import { UploadFilled } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import type { UploadFile, UploadFiles, UploadProps, UploadUserFile } from 'element-plus';
import { reactive, ref, shallowRef, watch } from 'vue';
import type { AuthorOption } from '../model';
import type { VideoRepository } from '../repository';
import type { TaxonomyRepository } from '../../taxonomy/model';

const props = defineProps<{
  modelValue: boolean;
  repository: VideoRepository;
  taxonomyRepository: TaxonomyRepository;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  uploaded: [];
}>();

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['mp4', 'webm', 'mov']);
const ALLOWED_CONTENT_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const form = reactive({
  authorId: '',
  title: '',
  description: '',
  categoryIds: [] as string[],
  tagIds: [] as string[]
});
const selectedFile = shallowRef<File | null>(null);
const fileList = ref<UploadUserFile[]>([]);
const coverUrl = ref<string | null>(null);
const authors = ref<AuthorOption[]>([]);
const categories = ref<{ id: string; name: string }[]>([]);
const tags = ref<{ id: string; name: string }[]>([]);
const loadingOptions = ref(false);
const optionsLoaded = ref(false);
const optionsError = ref('');
const submitting = ref(false);
const uploadRef = ref<InstanceType<typeof import('element-plus')['ElUpload']>>();

const fieldErrors = reactive({
  authorId: '',
  title: '',
  description: '',
  categoryIds: '',
  tagIds: '',
  file: ''
});

async function loadOptions(force = false) {
  if ((optionsLoaded.value && !force) || loadingOptions.value) return;
  loadingOptions.value = true;
  optionsError.value = '';
  try {
    const [authorItems, categoryPage, tagPage] = await Promise.all([
      props.repository.listAuthors(),
      props.taxonomyRepository.listCategories({ page: 1, pageSize: 100, status: 'ENABLED' }),
      props.taxonomyRepository.listTags({ page: 1, pageSize: 100, status: 'ENABLED' })
    ]);
    authors.value = authorItems;
    categories.value = categoryPage.items.map((c) => ({ id: c.id, name: c.name }));
    tags.value = tagPage.items.map((t) => ({ id: t.id, name: t.name }));
    optionsLoaded.value = true;
  } catch (error) {
    optionsError.value = error instanceof Error ? error.message : '上传选项加载失败';
    ElMessage.error(optionsError.value);
  } finally {
    loadingOptions.value = false;
  }
}

watch(() => props.modelValue, (open) => {
  if (open) void loadOptions();
}, { immediate: true });

function extractCover(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    video.addEventListener('loadeddata', () => {
      video.currentTime = 0.1;
    });

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    });

    video.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    });

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    }, 5000);

    video.addEventListener('seeked', () => { clearTimeout(timeout); }, { once: true });
    video.addEventListener('error', () => { clearTimeout(timeout); }, { once: true });
  });
}

async function handleFileChange(uploadFile: UploadFile, uploadFiles: UploadFiles = []) {
  selectedFile.value = uploadFile.raw ?? null;
  fieldErrors.file = '';
  fileList.value = uploadFiles.length > 0
    ? uploadFiles
    : selectedFile.value
      ? [{ name: selectedFile.value.name, size: selectedFile.value.size }]
      : [];
  if (selectedFile.value) {
    extractCover(selectedFile.value).then((url) => { coverUrl.value = url; });
  } else {
    coverUrl.value = null;
  }
}

const handleExceed: UploadProps['onExceed'] = (files) => {
  uploadRef.value?.clearFiles();
  const file = files[0];
  if (file) {
    selectedFile.value = file;
    fieldErrors.file = '';
    fileList.value = [{ name: file.name, size: file.size }];
    extractCover(file).then((url) => { coverUrl.value = url; });
  }
};

function handleFileRemove() {
  selectedFile.value = null;
  fileList.value = [];
  coverUrl.value = null;
  fieldErrors.file = '';
}

function clearFieldErrors() {
  Object.keys(fieldErrors).forEach((key) => {
    fieldErrors[key as keyof typeof fieldErrors] = '';
  });
}

watch(() => form.authorId, () => { fieldErrors.authorId = ''; });
watch(() => form.title, () => { fieldErrors.title = ''; });
watch(() => form.description, () => { fieldErrors.description = ''; });
watch(() => form.categoryIds.length, () => { fieldErrors.categoryIds = ''; });
watch(() => form.tagIds.length, () => { fieldErrors.tagIds = ''; });

function validateForm() {
  clearFieldErrors();
  const title = form.title.trim();
  if (!form.authorId) fieldErrors.authorId = '请选择作者';
  if (!title) fieldErrors.title = '请输入视频标题';
  else if (title.length > 120) fieldErrors.title = '视频标题不能超过 120 个字符';
  if (form.description.length > 2000) fieldErrors.description = '视频简介不能超过 2000 个字符';
  if (form.categoryIds.length < 1 || form.categoryIds.length > 3) fieldErrors.categoryIds = '请选择 1–3 个分类';
  if (form.tagIds.length > 10) fieldErrors.tagIds = '标签不能超过 10 个';
  if (!selectedFile.value) {
    fieldErrors.file = '请选择视频文件';
  } else if (selectedFile.value.size > MAX_FILE_SIZE) {
    fieldErrors.file = '视频文件不能超过 500 MB';
  } else {
    const extension = selectedFile.value.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_CONTENT_TYPES.has(selectedFile.value.type)) {
      fieldErrors.file = '仅支持 MP4、WebM 或 MOV 视频文件';
    }
  }
  return Object.values(fieldErrors).every((message) => !message);
}

function resetForm() {
  form.authorId = '';
  form.title = '';
  form.description = '';
  form.categoryIds = [];
  form.tagIds = [];
  selectedFile.value = null;
  fileList.value = [];
  coverUrl.value = null;
  clearFieldErrors();
}

function cancel() {
  if (submitting.value) return;
  resetForm();
  emit('update:modelValue', false);
}

function beforeClose(done: () => void) {
  if (submitting.value) return;
  resetForm();
  emit('update:modelValue', false);
  done();
}

async function submit() {
  if (!validateForm()) return;

  submitting.value = true;
  try {
    await props.repository.uploadDraft({
      authorId: form.authorId,
      title: form.title.trim(),
      description: form.description.trim(),
      categoryIds: [...form.categoryIds],
      tagIds: [...form.tagIds],
      file: selectedFile.value as File
    });
    ElMessage.success('视频上传成功');
    emit('uploaded');
    resetForm();
    emit('update:modelValue', false);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '视频上传失败');
  } finally {
    submitting.value = false;
  }
}

defineExpose({ form, fieldErrors, handleFileChange, submit });
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="新增视频"
    width="640px"
    :close-on-click-modal="false"
    :close-on-press-escape="!submitting"
    :before-close="beforeClose"
  >
    <el-alert
      v-if="optionsError"
      type="error"
      :title="optionsError"
      :closable="false"
      show-icon
      class="options-error"
    >
      <template #default>
        <el-button data-testid="retry-options" link type="primary" @click="loadOptions(true)">重新加载</el-button>
      </template>
    </el-alert>

    <el-form label-position="top" :model="form" v-loading="loadingOptions">
      <el-form-item label="作者" required :error="fieldErrors.authorId">
        <el-select v-model="form.authorId" placeholder="请选择作者" filterable class="full-width">
          <el-option v-for="author in authors" :key="author.id" :label="author.nickname" :value="author.id" />
        </el-select>
      </el-form-item>

      <el-form-item label="标题" required :error="fieldErrors.title">
        <el-input v-model="form.title" maxlength="120" show-word-limit placeholder="请输入视频标题" />
      </el-form-item>

      <el-form-item label="简介" :error="fieldErrors.description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="4"
          maxlength="2000"
          show-word-limit
          placeholder="请输入视频简介"
        />
      </el-form-item>

      <div class="selector-grid">
        <el-form-item label="分类" required :error="fieldErrors.categoryIds">
          <el-select
            v-model="form.categoryIds"
            multiple
            collapse-tags
            :max-collapse-tags="2"
            placeholder="请选择 1–3 个分类"
            class="full-width"
          >
            <el-option v-for="category in categories" :key="category.id" :label="category.name" :value="category.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="标签" :error="fieldErrors.tagIds">
          <el-select
            v-model="form.tagIds"
            multiple
            collapse-tags
            :max-collapse-tags="2"
            placeholder="最多选择 10 个标签"
            class="full-width"
          >
            <el-option v-for="tag in tags" :key="tag.id" :label="tag.name" :value="tag.id" />
          </el-select>
        </el-form-item>
      </div>

      <el-form-item label="视频文件" required :error="fieldErrors.file">
        <el-upload
          ref="uploadRef"
          drag
          action="#"
          accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
          :auto-upload="false"
          :limit="1"
          :file-list="fileList"
          :disabled="submitting"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
          :on-exceed="handleExceed"
          class="video-upload"
        >
          <el-icon class="upload-icon"><UploadFilled /></el-icon>
          <div>拖拽视频到此处，或<em>点击选择</em></div>
          <template #tip>
            <span class="upload-tip">支持 MP4、WebM、MOV，文件不超过 500 MB，只能上传一个视频</span>
          </template>
        </el-upload>
        <div v-if="coverUrl" class="cover-preview">
          <img :src="coverUrl" alt="视频封面预览" />
          <span>视频封面预览</span>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button :disabled="submitting" @click="cancel">取消</el-button>
      <el-button
        type="primary"
        data-testid="upload-submit"
        :loading="submitting"
        :disabled="loadingOptions || !!optionsError"
        @click="submit"
      >上传并创建草稿</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.options-error { margin-bottom: 18px; }
.full-width, .video-upload { width: 100%; }
.selector-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.upload-icon { margin-bottom: 10px; color: var(--yl-indigo); font-size: 34px; }
.video-upload em { color: var(--yl-indigo); font-style: normal; }
.upload-tip { color: var(--yl-text-muted); font-size: 11px; }
.cover-preview { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 12px; padding: 10px; background: var(--yl-surface, #f7f8fa); border: 1px solid var(--yl-border, #e4e7ed); border-radius: 8px; }
.cover-preview img { max-width: 280px; max-height: 158px; border-radius: 4px; object-fit: contain; }
.cover-preview span { color: var(--yl-text-muted); font-size: 11px; }
</style>
