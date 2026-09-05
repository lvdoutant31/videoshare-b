<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import AdminShell from '../layouts/AdminShell.vue';
import { OssTestError, uploadOssTest, type OssTestResult } from '../features/oss-test/repository';

const MAX_SIZE = 500 * 1024 * 1024;
const file = ref<File>(); const uploading = ref(false); const error = ref(''); const traceId = ref(''); const result = ref<OssTestResult>();
const fileLabel = computed(() => file.value ? `${file.value.name}（${(file.value.size / 1024 / 1024).toFixed(2)} MB）` : '未选择文件');
function choose(event: Event) { file.value = (event.target as HTMLInputElement).files?.[0]; error.value = ''; result.value = undefined; }
function validate() { if (!file.value) return '请选择文件'; if (file.value.size > MAX_SIZE) return '文件不能超过 500 MB'; return ''; }
async function submit() { error.value = ''; traceId.value = ''; result.value = undefined; const message = validate(); if (message) { error.value = message; return; } uploading.value = true; try { const response = await uploadOssTest(file.value!); result.value = response.data; traceId.value = response.traceId || ''; ElMessage.success('文件已上传到 OSS'); } catch (cause) { const e = cause instanceof OssTestError ? cause : new OssTestError('网络请求失败'); error.value = e.message; traceId.value = e.traceId || ''; } finally { uploading.value = false; } }
</script>
<template><AdminShell page-title="OSS 上传测试" page-subtitle="仅验证本地文件上传到阿里云 OSS"><section class="panel"><div class="intro"><p class="eyebrow">STORAGE / OSS TEST</p><h2>本地文件上传测试</h2><p>此页面只上传文件到 OSS，不创建视频、不保存视频业务数据。</p></div><div class="file-box"><input type="file" :disabled="uploading" @change="choose"><strong>{{ fileLabel }}</strong><small>单文件最大 500 MB，文件会保存到 test-uploads 前缀</small></div><el-alert v-if="error" type="error" :closable="false" :title="error" /><el-alert v-if="result" type="success" :closable="false" title="上传成功"><p>对象路径：{{ result.key }}</p><p>访问链接：<a :href="result.url" target="_blank" rel="noreferrer">{{ result.url }}</a></p><p v-if="traceId">traceId：{{ traceId }}</p></el-alert><el-button type="primary" :loading="uploading" :disabled="!file" @click="submit">{{ uploading ? '上传中，请勿关闭页面' : '上传到 OSS' }}</el-button></section></AdminShell></template>
<style scoped>.panel{max-width:760px;padding:28px;background:#fff;border:1px solid var(--yl-border);border-radius:12px}.intro{margin-bottom:22px}.intro h2{margin:7px 0;font-size:22px}.intro p:last-child{color:var(--yl-text-muted)}.eyebrow{color:var(--yl-teal);font-size:11px;letter-spacing:.16em}.file-box{display:grid;gap:9px;margin-bottom:18px;padding:28px;border:1px dashed #aab4c3;border-radius:9px;background:#f8fafc}.file-box small{color:var(--yl-text-muted)}.el-alert{margin-bottom:16px}.el-alert p{word-break:break-all}.el-alert a{color:var(--yl-indigo)}</style>
