import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://prompt-it-web.onrender.com';
const TOKEN_KEY = 'prompt_it_token';
const CSRF_KEY = 'prompt_it_csrf_token';

// ── Types ───────────────────────────────────────────────────────────

export interface User {
  name: string;
  email: string;
  plan: string;
  email_verified: boolean;
  usage?: {
    projects: number;
    monthly_generations: number;
  };
  limits?: {
    projects: number;
    monthly_generations: number;
    max_chapters: number;
  };
}

export interface AuthResponse {
  token: string;
  csrf_token: string;
  user: User;
  verification_token_demo?: string;
}

export interface ApiError {
  detail: string;
}

// ── Token helpers ───────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

async function setCsrfToken(token: string): Promise<void> {
  await AsyncStorage.setItem(CSRF_KEY, token);
}

async function clearTokens(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, CSRF_KEY]);
}

// ── Core request function ───────────────────────────────────────────

async function request<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // Set content-type for POST/PUT/PATCH
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    headers['Content-Type'] = 'application/json';
  }

  // Attach auth token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody.detail) {
        // detail can be a string or an array of validation errors
        if (Array.isArray(errorBody.detail)) {
          errorMessage = errorBody.detail
            .map((e: { msg?: string; loc?: string[] }) =>
              e.msg || (e.loc ? `${e.loc.join('.')}: error` : 'Validation error'),
            )
            .join('\n');
        } else {
          errorMessage = String(errorBody.detail);
        }
      }
    } catch {
      // ignore — use default message
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

// ── Auth API ────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const data = await request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await setToken(data.token);
  await setCsrfToken(data.csrf_token);
  return data;
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const data = await request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  await setToken(data.token);
  await setCsrfToken(data.csrf_token);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } catch {
    // proceed with local cleanup even if server call fails
  }
  await clearTokens();
}

export async function getMe(): Promise<User> {
  return request<User>('/api/auth/me');
}

// ── Workspaces API ───────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export async function getWorkspaces(): Promise<Workspace[]> {
  return request<Workspace[]>('/api/workspaces');
}

// ── Projects API ──────────────────────────────────────────────────

export interface Project {
  id: string;
  title: string;
  stage: string;
  status: string;
  progress: number;
  message: string;
}

export async function getProjects(): Promise<Project[]> {
  return request<Project[]>('/api/projects');
}

export async function getProject(id: string): Promise<Project> {
  return request<Project>(`/api/projects/${id}`);
}

export async function createProject(data: {
  title: string;
  chapter_count: number;
  audience: string;
  purpose: string;
  workspace_id?: string | null;
}): Promise<Project> {
  return request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function startProject(id: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/api/projects/${id}/start`, {
    method: 'POST',
  });
}

// ── Processing Tasks API ──────────────────────────────────────────

export interface ProcessingTask {
  task_type: string;
  executor: string;
  status: string;
  result?: unknown;
}

export async function getProcessingTasks(
  id: string,
): Promise<ProcessingTask[]> {
  return request<ProcessingTask[]>(`/api/projects/${id}/processing`);
}

// ── Agent Runs API ────────────────────────────────────────────────

export interface AgentRun {
  id: string;
  name: string;
  status: string;
}

export async function getAgentRuns(id: string): Promise<AgentRun[]> {
  return request<AgentRun[]>(`/api/projects/${id}/agents`);
}

// ── Verification API ─────────────────────────────────────────────

export async function resendVerification(): Promise<{ detail: string }> {
  return request<{ detail: string }>('/api/auth/resend-verification', {
    method: 'POST',
  });
}

// ── Workflows API ─────────────────────────────────────────────────

export interface Workflow {
  id: string;
  name: string;
  category: string;
  visibility: string;
  status: string;
  version: number;
  description: string;
}

export interface InstalledWorkflow {
  id: string;
  name: string;
  category: string;
  description: string;
  status: string;
  installed_at?: string;
  author?: string;
}

export async function getMyWorkflows(): Promise<Workflow[]> {
  return request<Workflow[]>('/api/workflows/mine');
}

export async function getInstalledWorkflows(): Promise<InstalledWorkflow[]> {
  return request<InstalledWorkflow[]>('/api/workflows/installed/list');
}

export async function publishWorkflow(workflowId: string): Promise<void> {
  return request(`/api/workflows/${workflowId}/publish`, { method: 'POST' });
}

// ── Marketplace API ────────────────────────────────────────────────

export interface MarketplaceWorkflow {
  id: string;
  name: string;
  creator_name: string;
  category: string;
  average_rating: number;
  rating_count: number;
  install_count: number;
  price_pence: number;
  description: string;
}

export async function getMarketplaceWorkflows(): Promise<MarketplaceWorkflow[]> {
  return request<MarketplaceWorkflow[]>('/api/marketplace/workflows');
}

export async function installWorkflow(
  workflowId: string,
  workspaceId?: string | null,
): Promise<void> {
  return request(`/api/workflows/${workflowId}/install`, {
    method: 'POST',
    body: JSON.stringify({ workspace_id: workspaceId || null }),
  });
}

// ── Account API ───────────────────────────────────────────────────

export async function updateAccount(data: { name: string }): Promise<User> {
  return request<User>('/api/account', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ── Billing API ───────────────────────────────────────────────────

export interface BillingStatus {
  enabled: boolean;
  configured: boolean;
  current_plan: string;
  subscription: {
    status: string;
  } | null;
}

export async function getBillingStatus(): Promise<BillingStatus> {
  return request<BillingStatus>('/api/billing/status');
}

export async function startCheckout(plan: string): Promise<{ url: string }> {
  return request<{ url: string }>('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
}

export async function openBillingPortal(): Promise<{ url: string }> {
  return request<{ url: string }>('/api/billing/portal', {
    method: 'POST',
  });
}

// ── Status API ────────────────────────────────────────────────────

export interface SystemStatus {
  live_ai: boolean;
  provider: string;
  model: string;
  queue_depth: number;
}

export async function getSystemStatus(): Promise<SystemStatus> {
  return request<SystemStatus>('/api/status');
}

// ── Email verification ────────────────────────────────────────────

export async function verifyEmail(token: string): Promise<void> {
  return request('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

// ── Token-only exports (for AuthContext bootstrap) ──────────────────

export { getToken, setToken, clearTokens };
