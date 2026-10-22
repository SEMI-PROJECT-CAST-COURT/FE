import { body, http } from './client';

export const WORK_PAGE_SIZE = 8;

// 작품 목록 · 상세는 { statusCode, result } 래퍼 없이 DTO를 그대로 준다.
export function fetchWorks({ categoryId, keyword, sort, page } = {}) {
  const params = {};
  if (categoryId) params.categoryId = categoryId;
  if (keyword && keyword.trim()) params.keyword = keyword.trim();
  if (sort) params.sort = sort;
  if (page) params.page = page;
  return http.get('/api/works', { params }).then(body);
}

export const fetchWork = (workId) => http.get(`/api/works/${workId}`).then(body);

function workForm(data, poster) {
  const form = new FormData();
  form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  if (poster) form.append('poster', poster);
  return form;
}

export const createWork = (data, poster) => http.post('/api/admin/works', workForm(data, poster)).then(body);

export const updateWork = (workId, data, poster) =>
  http.put(`/api/admin/works/${workId}`, workForm(data, poster)).then(() => undefined);

export const deleteWork = (workId) => http.delete(`/api/admin/works/${workId}`).then(() => undefined);

export const draftWorkSummary = (title, author) =>
  http.post('/api/admin/works/summary-draft', { title, author }).then(body);
