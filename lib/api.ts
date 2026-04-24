import * as tokenStore from './tokenStore';
import type {
  AlertResponse,
  ApiErrorShape,
  AuthRequest,
  AuthResponse,
  CreateIncidentRequest,
  CreateSiteRequest,
  EnrollRequest,
  EnrollResponse,
  EventLogRequest,
  FullHistoryResponse,
  IncidentResponse,
  MovementAlert,
  MovementAlertStatus,
  PageResponse,
  SiteResponse,
  TelemetryPushRequest,
  TelemetrySnapshot,
  Terminal,
  TerminalConnectionHistoryResponse,
  TerminalSummary,
  UpdateIncidentRequest,
  UpdateTerminalSettingsRequest,
} from './types';

const RAW_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ||
  'http://192.168.1.70:8080/api';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

const RAW_WS_URL =
  process.env.EXPO_PUBLIC_WS_URL?.trim() ||
  'ws://192.168.1.70:8080/ws/websocket';
const WS_URL = RAW_WS_URL.replace(/\/+$/, '');

let unauthorizedHandler: (() => void) | null = null;

export function registerUnauthorizedHandler(cb: () => void): void {
  unauthorizedHandler = cb;
}

export function getApiBaseUrl(): string {
  return BASE_URL;
}

export function getWebSocketUrl(): string {
  return WS_URL;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: ApiErrorShape,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const admin = await tokenStore.getAdminToken();
  if (admin) return { Authorization: `Bearer ${admin}` };
  const device = await tokenStore.getDeviceToken();
  if (device) return { Authorization: `Bearer ${device}` };
  return {};
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  return fetchAndParse<T>(method, path, body, {
    'Content-Type': 'application/json',
    ...(await authHeader()),
  });
}

export async function requestWithToken<T>(
  method: string,
  path: string,
  body: unknown,
  token: string,
): Promise<T> {
  return fetchAndParse<T>(method, path, body, {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });
}

function buildNetworkErrorMessage(): string {
  return [
    'Backend inaccessible.',
    'Verifiez que le serveur tourne sur 192.168.1.70:8080.',
    'Verifiez que le telephone et ce poste sont sur le meme reseau local.',
  ].join(' ');
}

async function fetchAndParse<T>(
  method: string,
  path: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, buildNetworkErrorMessage(), {
      error: 'NETWORK_ERROR',
      message: buildNetworkErrorMessage(),
      path,
    });
  }

  if (response.status === 401) {
    unauthorizedHandler?.();
    throw new ApiError(401, 'Session expiree ou non autorisee.');
  }

  if (!response.ok) {
    let details: ApiErrorShape | undefined;
    let message = `Erreur serveur ${response.status}`;

    try {
      details = (await response.json()) as ApiErrorShape;
      message = details.message ?? details.error ?? message;
    } catch {
      // noop
    }

    throw new ApiError(response.status, message, details);
  }

  const ct = response.headers.get('content-type') ?? '';
  if (response.status === 204 || !ct.includes('application/json')) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const authApi = {
  login: (body: AuthRequest) => request<AuthResponse>('POST', '/auth/login', body),
};

export const terminalsApi = {
  enroll: (body: EnrollRequest) => request<EnrollResponse>('POST', '/terminals/enroll', body),
  list: () => request<TerminalSummary[]>('GET', '/terminals'),
  getById: (id: number) => request<Terminal>('GET', `/terminals/${id}`),
  rename: (id: number, displayName: string) =>
    request<Terminal>('PATCH', `/terminals/${id}/name`, { displayName }),
  updateSettings: (id: number, body: UpdateTerminalSettingsRequest) =>
    request<Terminal>('PATCH', `/terminals/${id}/settings`, body),
  patch: (id: number, body: UpdateTerminalSettingsRequest) =>
    request<Terminal>('PATCH', `/terminals/${id}`, body),
  delete: (id: number) => request<void>('DELETE', `/terminals/${id}`),
  getHistory: (id: number, page = 0, size = 20) =>
    request<PageResponse<TelemetrySnapshot>>(
      'GET',
      `/terminals/${id}/history?page=${page}&size=${size}`,
    ),
  getConnections: (id: number, page = 0, size = 20) =>
    request<PageResponse<TerminalConnectionHistoryResponse>>(
      'GET',
      `/terminals/${id}/connections?page=${page}&size=${size}`,
    ),
  getFullHistory: (id: number, page = 0, size = 20) =>
    request<FullHistoryResponse>('GET', `/terminals/${id}/full-history?page=${page}&size=${size}`),
};

export const telemetryApi = {
  push: (body: TelemetryPushRequest) => request<void>('POST', '/telemetry/push', body),
  listLatest: (size = 50) => request<TelemetrySnapshot[]>('GET', `/telemetry?size=${size}`),
  getById: (id: number) => request<TelemetrySnapshot>('GET', `/telemetry/${id}`),
  listByTerminal: (terminalId: number, size = 20) =>
    request<TelemetrySnapshot[]>('GET', `/telemetry/terminal/${terminalId}?size=${size}`),
  streamUrl: () => `${BASE_URL}/telemetry/stream`,
};

export const alertsApi = {
  list: (page = 0, size = 50, severity?: string) => {
    const p = new URLSearchParams({ page: String(page), size: String(size) });
    if (severity) p.set('severity', severity);
    return request<PageResponse<AlertResponse>>('GET', `/alerts?${p.toString()}`);
  },
  listByTerminal: (terminalId: number, page = 0, size = 50) =>
    request<PageResponse<AlertResponse>>(
      'GET',
      `/alerts/terminal/${terminalId}?page=${page}&size=${size}`,
    ),
  acknowledge: (id: number) => request<void>('PATCH', `/alerts/${id}/acknowledge`),
  createEvent: (body: EventLogRequest) => request<void>('POST', '/events', body),
};

export const movementAlertsApi = {
  list: (status?: MovementAlertStatus, page = 0, size = 50) => {
    const p = new URLSearchParams({ page: String(page), size: String(size) });
    if (status) p.set('status', status);
    return request<PageResponse<MovementAlert>>('GET', `/alerts/movement?${p.toString()}`);
  },
  listByTerminal: (terminalId: number, page = 0, size = 20) =>
    request<PageResponse<MovementAlert>>(
      'GET',
      `/alerts/movement/terminal/${terminalId}?page=${page}&size=${size}`,
    ),
  resolve: (id: number) => request<MovementAlert>('PATCH', `/alerts/movement/${id}/resolve`),
};

export const incidentsApi = {
  create: (body: CreateIncidentRequest) =>
    request<IncidentResponse>('POST', '/incidents', body),
  list: (status?: string, terminalId?: number) => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (terminalId) p.set('terminalId', String(terminalId));
    const qs = p.toString();
    return request<IncidentResponse[]>('GET', `/incidents${qs ? `?${qs}` : ''}`);
  },
  getById: (id: number) => request<IncidentResponse>('GET', `/incidents/${id}`),
  update: (id: number, body: UpdateIncidentRequest) =>
    request<IncidentResponse>('PATCH', `/incidents/${id}`, body),
};

export const sitesApi = {
  create: (body: CreateSiteRequest) => request<SiteResponse>('POST', '/sites', body),
  list: (page = 0, size = 20, zone?: string) => {
    const p = new URLSearchParams({ page: String(page), size: String(size) });
    if (zone) p.set('zone', zone);
    return request<PageResponse<SiteResponse>>('GET', `/sites?${p.toString()}`);
  },
  getById: (id: number) => request<SiteResponse>('GET', `/sites/${id}`),
  patch: (id: number, body: Partial<CreateSiteRequest>) =>
    request<SiteResponse>('PATCH', `/sites/${id}`, body),
  delete: (id: number) => request<void>('DELETE', `/sites/${id}`),
};

export type ResetTestDataResponse = {
  deletedTerminals: number;
  deletedTelemetries: number;
  deletedEvents: number;
};

export const adminApi = {
  resetTestData: () => request<ResetTestDataResponse>('DELETE', '/admin/reset-test-data'),
};

export const simulatorApi = {
  enroll: (body: EnrollRequest) => request<EnrollResponse>('POST', '/terminals/enroll', body),
  pushTelemetry: (body: TelemetryPushRequest, deviceToken: string) =>
    requestWithToken<void>('POST', '/telemetry/push', body, deviceToken),
  pushEvent: (body: EventLogRequest, deviceToken: string) =>
    requestWithToken<void>('POST', '/events', body, deviceToken),
  listTerminals: () => request<TerminalSummary[]>('GET', '/terminals'),
};
