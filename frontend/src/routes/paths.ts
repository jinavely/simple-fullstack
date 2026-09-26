import { generatePath } from 'react-router'

export const ROUTES = {
  HOME: '/',
  POSTS: '/posts',
  POST_NEW: '/posts/new',
  POST_DETAIL: '/posts/:id',
  POST_EDIT: '/posts/:id/edit',
  LOGIN: '/login',
  SIGNUP: '/signup',
  MYPAGE: '/mypage',
  NOT_FOUND: '*',
} as const

type Id = string | number

export const toPostDetail = (id: Id) =>
  generatePath(ROUTES.POST_DETAIL, { id: String(id) })

export const toPostEdit = (id: Id) =>
  generatePath(ROUTES.POST_EDIT, { id: String(id) })
