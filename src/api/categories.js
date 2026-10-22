import { body, http, unwrap } from './client';

export const fetchCategories = () => http.get('/api/categories').then(unwrap);

export const createCategory = (name) => http.post('/api/admin/categories', { name }).then(body);

export const renameCategory = (categoryId, name) =>
  http.patch(`/api/admin/categories/${categoryId}`, { name }).then(() => undefined);

// 미분류를 뺀 나머지 전체 id를 새 순서로 보낸다.
export const reorderCategories = (categoryIds) =>
  http.put('/api/admin/categories/order', { categoryIds }).then(() => undefined);

export const deleteCategory = (categoryId) =>
  http.delete(`/api/admin/categories/${categoryId}`).then(() => undefined);
