<script setup lang="ts">
import { UploadFilled } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import type { UploadFile, UploadFiles, UploadProps, UploadUserFile } from 'element-plus';
import { reactive, ref, shallowRef, watch } from 'vue';
import { authState } from '../../auth/repository';
import type { VideoRepository } from '../repository';
import type { TaxonomyRepository } from '../../taxonomy/model';
import { cleanRichText, hasRichText } from '../richText';
import RichTextEditor from '../../../components/RichTextEditor.vue';
import { uploadContentImage } from '../images';

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
const contentType = ref<'video' | 'article' | null>(null);

const form = reactive({
  title: '',
  description: '',
  categoryIds: [] as string[],
  tagIds: [] as string[]
});
const selectedFile = shallowRef<File | null>(null);
const fileList = ref<UploadUserFile[]>([]);
const coverUrl = ref<string | null>(null);
const categories = ref<{ id: string; name: string }[]>([]);
const tags = ref<{ id: string; name: string }[]>([]);
const loadingOptions = ref(false);
const optionsLoaded = ref(false);
const optionsError = ref('');
const submitting = ref(false);
const uploadingImages = ref(false);
const uploadRef = ref<InstanceType<typeof import('element-plus')['ElUpload']>>();

const fieldErrors = reactive({
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
    const [categoryPage, tagPage] = await Promise.all([
      props.taxonomyRepository.listCategories({ page: 1, pageSize: 100, status: 'ENABLED' }),
      props.taxonomyRepository.listTags({ page: 1, pageSize: 100, status: 'ENABLED' })
    ]);
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
  if (open) {
    void loadOptions();

  }
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

function chooseContentType(type: 'video' | 'article') {
  contentType.value = type;
  if (type === 'article') {
    selectedFile.value = null;
    fileList.value = [];
    coverUrl.value = null;
    uploadRef.value?.clearFiles();
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

watch(() => form.title, () => { fieldErrors.title = ''; });
watch(() => form.description, () => { fieldErrors.description = ''; });
watch(() => form.categoryIds.length, () => { fieldErrors.categoryIds = ''; });
watch(() => form.tagIds.length, () => { fieldErrors.tagIds = ''; });

function validateForm() {
  clearFieldErrors();
  if (!contentType.value) fieldErrors.description = '请选择发布类型';
  const title = form.title.trim();
  if (!title) fieldErrors.title = '请输入视频标题';
  else if (title.length > 120) fieldErrors.title = '视频标题不能超过 120 个字符';
  const description = cleanRichText(form.description);
  if (description.length > 100000) fieldErrors.description = '正文不能超过 100000 个字符';
  if (form.categoryIds.length < 1 || form.categoryIds.length > 3) fieldErrors.categoryIds = '请选择 1–3 个分类';
  if (form.tagIds.length > 10) fieldErrors.tagIds = '标签不能超过 10 个';
  if (selectedFile.value && selectedFile.value.size > MAX_FILE_SIZE) {
    fieldErrors.file = '视频文件不能超过 500 MB';
  } else if (selectedFile.value) {
    const extension = selectedFile.value.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_CONTENT_TYPES.has(selectedFile.value.type)) {
      fieldErrors.file = '仅支持 MP4、WebM 或 MOV 视频文件';
    }
  }
  if (contentType.value === 'video' && !selectedFile.value) fieldErrors.file = '请添加视频文件';
  if (contentType.value === 'article' && !hasRichText(description)) fieldErrors.description = '请填写图文正文';
  return Object.values(fieldErrors).every((message) => !message);
}

function resetForm() {
  contentType.value = null;
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
  if (submitting.value || uploadingImages.value) return;
  resetForm();
  emit('update:modelValue', false);
}

function beforeClose(done: () => void) {
  if (submitting.value || uploadingImages.value) return;
  resetForm();
  emit('update:modelValue', false);
  done();
}

async function submit() {
  if (submitting.value || uploadingImages.value) return;
  if (!validateForm()) return;

  submitting.value = true;
  try {
    await props.repository.uploadDraft({
      title: form.title.trim(),
      description: cleanRichText(form.description).trim(),
      categoryIds: [...form.categoryIds],
      tagIds: [...form.tagIds],
      file: contentType.value === 'video' ? selectedFile.value ?? undefined : undefined
    });
    ElMessage.success('内容创建成功');
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
    title="新增内容"
    width="640px"
    :close-on-click-modal="false"
    :close-on-press-escape="!submitting && !uploadingImages"
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
      <div v-if="!contentType" class="content-type-picker" role="group" aria-label="选择内容类型">
        <button type="button" class="content-type-card" @click="chooseContentType('video')">
          <strong>发布视频</strong><span>上传视频，可添加富文本正文</span>
        </button>
        <button type="button" class="content-type-card" @click="chooseContentType('article')">
          <strong>发布图文</strong><span>编辑图文或纯文字，首图作为封面</span>
        </button>
      </div>
      <template v-else>
        <div class="selected-type"><span>正在发布{{ contentType === 'video' ? '视频' : '图文' }}</span><el-button link type="primary" @click="contentType = null">更换类型</el-button></div>
      <el-form-item label="作者">
        <el-input :model-value="authState.session?.username ?? '当前登录用户'" readonly />
      </el-form-item>

      <el-form-item label="标题" required :error="fieldErrors.title">
        <el-input v-model="form.title" maxlength="120" show-word-limit placeholder="请输入标题" />
      </el-form-item>

      <el-form-item :label="contentType === 'video' ? '正文（选填）' : '图文正文'" :error="fieldErrors.description">
        <RichTextEditor v-model="form.description" :upload-image="uploadContentImage" :disabled="submitting" @busy="uploadingImages = $event" @error="ElMessage.error($event)" />
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

      <el-form-item v-if="contentType === 'video'" label="视频文件" :error="fieldErrors.file">
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
            <span class="upload-tip">请上传 MP4、WebM 或 MOV 视频，文件不超过 500 MB；正文可选</span>
          </template>
        </el-upload>
        <div v-if="coverUrl" class="cover-preview">
          <img :src="coverUrl" alt="视频封面预览" />
          <span>视频封面预览</span>
        </div>
      </el-form-item>
      </template>
    </el-form>

    <template #footer>
      <el-button :disabled="submitting || uploadingImages" @click="cancel">取消</el-button>
      <el-button
        type="primary"
        data-testid="upload-submit"
        :loading="submitting"
        :disabled="!contentType || loadingOptions || !!optionsError || uploadingImages"
        @click="submit"
      >创建内容</el-button>
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
.content-type-picker { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:12px 0 20px; }
.content-type-card { display:grid; gap:8px; min-height:100px; padding:18px; text-align:left; border:1px solid var(--yl-border); border-radius:10px; background:var(--yl-surface); cursor:pointer; }
.content-type-card:hover { border-color:var(--yl-indigo); background:#f5f6ff; }
.content-type-card strong { color:var(--yl-text); font-size:15px; }
.content-type-card span,.selected-type { color:var(--yl-text-muted); font-size:12px; }
.selected-type { display:flex; align-items:center; justify-content:space-between; margin:4px 0 14px; }
</style>
