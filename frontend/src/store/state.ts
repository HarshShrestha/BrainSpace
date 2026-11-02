import { atom } from 'recoil';
import type { Content, User } from '../types';
export const userState = atom<User | null>({ key: 'user', default: null });
export const contentState = atom<Content[]>({ key: 'content', default: [] });
