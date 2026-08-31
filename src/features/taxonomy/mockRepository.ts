import { TaxonomyError } from './repository';
import type { Category, CategoryInput, PageQuery, PageResult, Tag, TagInput, TaxonomyRepository } from './model';

const now = '2026-08-27T08:00:00.000Z';

function clone<T>(value: T): T { return structuredClone(value); }
function page<T>(items: T[], query: PageQuery): PageResult<T> {
  const filtered = items.filter((item) => {
    const named = item as { name: string; status: string };
    return (!query.keyword || named.name.includes(query.keyword)) && (!query.status || named.status === query.status);
  });
  const start = (query.page - 1) * query.pageSize;
  return { items: clone(filtered.slice(start, start + query.pageSize)), page: query.page, pageSize: query.pageSize, total: filtered.length };
}

export function createMockTaxonomyRepository(): TaxonomyRepository {
  let categoryId = 5;
  let tagId = 6;
  let categories: Category[] = [
    { id: '1', name: '企业文化', icon: 'building', sort: 10, status: 'ENABLED', createdAt: now, updatedAt: now },
    { id: '2', name: '安全生产', icon: 'shield', sort: 20, status: 'ENABLED', createdAt: now, updatedAt: now },
    { id: '3', name: '技能培训', icon: 'graduation-cap', sort: 30, status: 'ENABLED', createdAt: now, updatedAt: now },
    { id: '4', name: '历史活动', icon: null, sort: 90, status: 'DISABLED', createdAt: now, updatedAt: now }
  ];
  let tags: Tag[] = [
    { id: '1', name: '入职培训', heatScore: 96, status: 'ENABLED', createdAt: now, updatedAt: now },
    { id: '2', name: '安全规范', heatScore: 88, status: 'ENABLED', createdAt: now, updatedAt: now },
    { id: '3', name: '设备巡检', heatScore: 75, status: 'ENABLED', createdAt: now, updatedAt: now },
    { id: '4', name: '往期活动', heatScore: 14, status: 'DISABLED', createdAt: now, updatedAt: now }
  ];

  function assertUnique(items: { id: string; name: string }[], name: string, id?: string) {
    if (items.some((item) => item.id !== id && item.name === name)) {
      throw new TaxonomyError('名称已存在，请使用其他名称', { code: 'DUPLICATE_NAME' });
    }
  }

  return {
    async listCategories(query) { return page([...categories].sort((a, b) => a.sort - b.sort || Number(b.id) - Number(a.id)), query); },
    async createCategory(input) {
      assertUnique(categories, input.name);
      const item: Category = { id: String(categoryId++), icon: input.icon ?? null, ...input, createdAt: now, updatedAt: now };
      categories.push(item);
      return clone(item);
    },
    async updateCategory(id, input) {
      const index = categories.findIndex((item) => item.id === id);
      if (index < 0) throw new TaxonomyError('分类不存在', { code: 'CATEGORY_NOT_FOUND' });
      if (input.name) assertUnique(categories, input.name, id);
      const item = { ...categories[index], ...input, updatedAt: now };
      categories[index] = item;
      return clone(item);
    },
    async deleteCategory(id) {
      if (id === '2') throw new TaxonomyError('分类已被视频引用，请先停用分类', { code: 'CATEGORY_IN_USE' });
      categories = categories.filter((item) => item.id !== id);
    },
    async listTags(query) { return page([...tags].sort((a, b) => b.heatScore - a.heatScore || Number(b.id) - Number(a.id)), query); },
    async createTag(input) {
      assertUnique(tags, input.name);
      const item: Tag = { id: String(tagId++), ...input, createdAt: now, updatedAt: now };
      tags.push(item);
      return clone(item);
    },
    async updateTag(id, input) {
      const index = tags.findIndex((item) => item.id === id);
      if (index < 0) throw new TaxonomyError('标签不存在', { code: 'TAG_NOT_FOUND' });
      if (input.name) assertUnique(tags, input.name, id);
      const item = { ...tags[index], ...input, updatedAt: now };
      tags[index] = item;
      return clone(item);
    },
    async deleteTag(id) {
      if (id === '2') throw new TaxonomyError('标签已被视频引用，请先停用标签', { code: 'TAG_IN_USE' });
      tags = tags.filter((item) => item.id !== id);
    }
  };
}
