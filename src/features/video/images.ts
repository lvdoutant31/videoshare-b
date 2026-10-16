export async function uploadContentImage(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/videoshare';
  const response = await fetch(`${baseUrl}/api/v1/admin/content/images`, { method: 'POST', credentials: 'include', body });
  const result = await response.json() as { code: string; message?: string; data?: { url: string } };
  if (!response.ok || result.code !== 'OK' || !result.data?.url) throw new Error(result.message ?? '图片上传失败');
  return result.data.url;
}
