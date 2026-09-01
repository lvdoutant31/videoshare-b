export type ResourceStatus = 'ENABLED' | 'DISABLED';

export interface PageQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: ResourceStatus | 'DELETED';
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

interface ResourceBase {
  id: string;
  name: string;
  status: ResourceStatus;
  deleted?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category extends ResourceBase {
  icon: string | null;
  sort: number;
}

export interface Tag extends ResourceBase {
  heatScore: number;
}

export interface CategoryInput {
  name: string;
  icon?: string | null;
  sort: number;
  status: ResourceStatus;
}

export interface TagInput {
  name: string;
  heatScore: number;
  status: ResourceStatus;
}

export interface TaxonomyRepository {
  listCategories(query: PageQuery): Promise<PageResult<Category>>;
  listCategoriesTrash?(query: PageQuery): Promise<PageResult<Category>>;
  createCategory(input: CategoryInput): Promise<Category>;
  updateCategory(id: string, input: Partial<CategoryInput>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  restoreCategory?(id: string): Promise<Category>;
  listTags(query: PageQuery): Promise<PageResult<Tag>>;
  listTagsTrash?(query: PageQuery): Promise<PageResult<Tag>>;
  createTag(input: TagInput): Promise<Tag>;
  updateTag(id: string, input: Partial<TagInput>): Promise<Tag>;
  deleteTag(id: string): Promise<void>;
  restoreTag?(id: string): Promise<Tag>;
}
