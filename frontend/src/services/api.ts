import type {
  Content,
  ContentInput,
  SharedBrain,
  User,
  RagStatus,
  RagAnswer,
} from "../types";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const base = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      credentials: "include",
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError(
      "Could not connect to BrainSpace. Check your connection and try again.",
      0,
    );
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      body.message || "Something went wrong. Please try again.",
      response.status,
    );
  return body.data as T;
}
const post = <T>(path: string, data?: unknown) =>
  request<T>(path, {
    method: "POST",
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
export const api = {
  me: () => request<User>("/auth/me"),
  login: (username: string, password: string) =>
    post<User>("/auth/login", { username, password }),
  signup: (username: string, password: string) =>
    post<User>("/auth/signup", { username, password }),
  logout: () => post<null>("/auth/logout"),
  list: () => request<Content[]>("/content"),
  add: (input: ContentInput) => post<Content>("/content", input),
  remove: (id: string) =>
    request<null>(`/content/${encodeURIComponent(id)}`, { method: "DELETE" }),
  share: () => post<{ token: string }>("/share"),
  revoke: () => request<null>("/share", { method: "DELETE" }),
  assistantStatus: () => request<RagStatus>("/assistant/status"),
  indexContent: (id: string, text: string) =>
    post<{ indexedAt: string; sourceType: string; chunks: number }>(
      `/assistant/index/${encodeURIComponent(id)}`,
      { consent: true, ...(text.trim() ? { text } : {}) },
    ),
  removeIndex: (id: string) =>
    request<null>(`/assistant/index/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  ask: (question: string) => post<RagAnswer>("/assistant/ask", { question }),
  shared: (token: string) =>
    request<SharedBrain>(`/share/${encodeURIComponent(token)}`),
};
