<!-- <script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import AdminShell from '../layouts/AdminShell.vue';
import { uploadVideo, VideoUploadError } from '../features/video/repository';

const MAX_SIZE = 500 * 1024 * 1024;
const authorId = ref('1002'); const title = ref(''); const description = ref(''); const categoryIds = ref('1005'); const tagIds = ref('');
const file = ref<File>(); const uploading = ref(false); const error = ref(''); const traceId = ref(''); const result = ref<Record<string, unknown>>();
const fileLabel = computed(() => file.value ? `${file.value.name}（${(file.value.size / 1024 / 1024).toFixed(2)} MB）` : '未选择文件');
function choose(event: Event) { file.value = (event.target as HTMLInputElement).files?.[0]; }
// function validate() {
//   if (!authorId.value.trim() || !title.value.trim()) return '作者 ID 和标题不能为空'; if (!categoryIds.value.trim()) return '至少填写一个分类 ID'; if (!file.value) return '请选择视频文件';
//   const suffix = file.value.name.toLowerCase().slice(file.value.name.lastIndexOf('.')); if (!['.mp4', '.webm', '.mov'].includes(suffix) || !['video/mp4', 'video/webm', 'video/quicktime'].includes(file.value.type)) return '仅支持 MP4、WebM 或 MOV';
//   return file.value.size > MAX_SIZE ? '文件不能超过 500 MB' : '';
// }
async function submit() {
  error.value = ''; result.value = undefined; traceId.value = ''; const message = validate(); if (message) { error.value = message; return; } uploading.value = true;
  try { const response = await uploadVideo({ authorId: authorId.value.trim(), title: title.value.trim(), description: description.value.trim(), categoryIds: categoryIds.value.split(',').map((v) => v.trim()).filter(Boolean), tagIds: tagIds.value.split(',').map((v) => v.trim()).filter(Boolean), visibility: 'PUBLIC', file: file.value! }); result.value = response.data; traceId.value = response.traceId || ''; ElMessage.success('视频已上传到 OSS 并保存数据库'); }
  catch (cause) { const e = cause instanceof VideoUploadError ? cause : new VideoUploadError('网络请求失败'); error.value = e.message; traceId.value = e.traceId || ''; } finally { uploading.value = false; }
}
</script>
<template><AdminShell><section class="head"><p>MEDIA / OSS</p><h1>视频上传测试</h1><span>从本地选择视频，验证上传阿里云 OSS 和数据库保存。</span></section><section class="panel"><el-form label-position="top" @submit.prevent="submit"><div class="grid"><el-form-item label="作者 ID"><el-input v-model="authorId" :disabled="uploading" /></el-form-item><el-form-item label="视频标题"><el-input v-model="title" :disabled="uploading" maxlength="120" /></el-form-item></div><el-form-item label="描述"><el-input v-model="description" :disabled="uploading" type="textarea" maxlength="2000" /></el-form-item><div class="grid"><el-form-item label="分类 ID（逗号分隔）"><el-input v-model="categoryIds" :disabled="uploading" /></el-form-item><el-form-item label="标签 ID（可选）"><el-input v-model="tagIds" :disabled="uploading" /></el-form-item></div><el-form-item label="视频文件"><div class="file"><input type="file" accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime" :disabled="uploading" @change="choose"><b>{{ fileLabel }}</b><small>支持 MP4 / WebM / MOV，最大 500 MB</small></div></el-form-item><el-alert v-if="error" type="error" :closable="false" :title="error" /><el-alert v-if="result" type="success" :closable="false" title="上传成功"><pre>{{ JSON.stringify(result, null, 2) }}</pre><p v-if="traceId">traceId：{{ traceId }}</p></el-alert><el-button type="primary" :loading="uploading" @click="submit">{{ uploading ? '上传中' : '上传到 OSS' }}</el-button></el-form></section></AdminShell></template>
<style scoped>.head{margin-bottom:18px}.head p{color:var(--yl-teal);font-size:11px;letter-spacing:.16em}.head h1{margin:6px 0}.head span{color:#667085}.panel{max-width:850px;padding:24px;background:#fff;border:1px solid #e4e7ec;border-radius:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.file{display:grid;gap:7px;width:100%;padding:18px;border:1px dashed #aab4c3;border-radius:8px;background:#f8fafc}.file small{color:#667085}pre{max-width:100%;overflow:auto;font-size:12px}.el-alert{margin-bottom:16px}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style> -->
