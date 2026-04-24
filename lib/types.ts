export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'LOST';
export type DeviceType = 'TPE' | 'PHONE';
export type TerminalConnectivityStatus = 'ONLINE' | 'OFFLINE';
export type TerminalConnectionEventType = 'CONNECTED' | 'RECONNECTED' | 'DISCONNECTED';

export type NetworkType =
  | 'WIFI'
  | 'CELL_2G'
  | 'CELL_3G'
  | 'CELL_4G'
  | 'CELL_5G'
  | 'ETHERNET'
  | 'NONE'
  | 'UNKNOWN';

export type EventType =
  | 'OFFLINE'
  | 'BACK_ONLINE'
  | 'LOW_BATTERY'
  | 'APP_CRASH'
  | 'SIM_CHANGE'
  | 'IMEI_CHANGE'
  | 'GPS_ANOMALY'
  | 'STORAGE_LOW'
  | 'REBOOT'
  | 'NETWORK_LOSS'
  | 'CUSTOM';

export type EventSeverity = 'INFO' | 'WARN' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER' | 'TESTER';
export type MovementAlertStatus = 'TRIGGERED' | 'RESOLVED';

export type AuthRequest = {
  username: string;
  password: string;
};

export type AuthResponse = {
  token: string;
  tokenType: string;
  username: string;
  role: string;
  expiresInMs: number;
};

export type EnrollRequest = {
  serialNumber?: string | null;
  imei1?: string | null;
  imei2?: string | null;
  iccid?: string | null;
  androidId?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  brand?: string | null;
  osVersion?: string | null;
  sdkInt?: number | null;
  agentVersion?: string | null;
  appPackage?: string | null;
  appVersionName?: string | null;
  deviceType?: DeviceType | null;
  displayName?: string | null;
};

export type EnrollResponse = {
  terminalId: number;
  deviceKey: string;
  deviceToken: string;
  tokenType: string;
  tokenExpiresInMs: number;
  created: boolean;
};

export type TerminalSummary = {
  id: number;
  deviceKey: string;
  serialNumber?: string | null;
  imei1?: string | null;
  androidId?: string | null;
  deviceId?: string | null;
  installationId?: string | null;
  hardwareId?: string | null;
  uuid?: string | null;
  displayName?: string | null;
  deviceType?: DeviceType | null;
  authorizedZoneName?: string | null;
  baseLatitude?: number | null;
  baseLongitude?: number | null;
  alertRadiusMeters?: number | null;
  lastGpsLat?: number | null;
  lastGpsLng?: number | null;
  lastBatteryPercent?: number | null;
  lastNetworkType?: NetworkType | null;
  lastSignalLevel?: number | null;
  lastStorageFreeMb?: number | null;
  lastStorageTotalMb?: number | null;
  lastActivityAt?: string | null;
  totalConnectionCount?: number | null;
  lastConnectedAt?: string | null;
  lastDisconnectedAt?: string | null;
  lastSeenAt?: string | null;
  updatedAt?: string | null;
  connectivityStatus?: TerminalConnectivityStatus | null;
  outsideAuthorizedZone?: boolean | null;
  lastAddressLine?: string | null;
  city?: string | null;
  country?: string | null;
};

export type Terminal = {
  id: number;
  deviceKey: string;
  displayName?: string | null;
  deviceType?: DeviceType | null;
  serialNumber?: string | null;
  imei1?: string | null;
  imei2?: string | null;
  iccid?: string | null;
  androidId?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  brand?: string | null;
  status?: DeviceStatus | null;
  connectivityStatus?: TerminalConnectivityStatus | null;
  authorizedZoneName?: string | null;
  lastGpsLat?: number | null;
  lastGpsLng?: number | null;
  baseLatitude?: number | null;
  baseLongitude?: number | null;
  alertRadiusMeters?: number | null;
  outsideAuthorizedZone?: boolean | null;
  lastAddressLine?: string | null;
  lastDistrict?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
  lastBatteryPercent?: number | null;
  lastNetworkType?: NetworkType | null;
  lastSignalLevel?: number | null;
  lastStorageFreeMb?: number | null;
  lastStorageTotalMb?: number | null;
  lastActivityAt?: string | null;
  totalConnectionCount?: number | null;
  lastConnectedAt?: string | null;
  lastDisconnectedAt?: string | null;
  siteId?: number | null;
  agency?: string | null;
  merchant?: string | null;
  notes?: string | null;
  osVersion?: string | null;
  sdkInt?: number | null;
  agentVersion?: string | null;
  appPackage?: string | null;
  appVersionName?: string | null;
  appVersionCode?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastSeenAt?: string | null;
};

export type UpdateTerminalSettingsRequest = {
  displayName?: string | null;
  authorizedZoneName?: string | null;
  baseLatitude?: number | null;
  baseLongitude?: number | null;
  alertRadiusMeters?: number | null;
  siteId?: number | null;
  agency?: string | null;
  merchant?: string | null;
  notes?: string | null;
  status?: DeviceStatus | null;
};

export type TelemetrySnapshot = {
  id: number;
  terminalId: number;
  capturedAt: string;
  batteryPercent?: number | null;
  charging?: boolean | null;
  batteryTemp?: number | null;
  batteryVoltageMv?: number | null;
  batteryHealth?: string | null;
  chargePlug?: string | null;
  networkType?: NetworkType | null;
  signalLevel?: number | null;
  ipAddress?: string | null;
  publicIp?: string | null;
  carrierName?: string | null;
  carrierMccMnc?: string | null;
  roaming?: boolean | null;
  simOperatorName?: string | null;
  simCountryIso?: string | null;
  iccid?: string | null;
  wifiSsid?: string | null;
  wifiBssid?: string | null;
  wifiRssi?: number | null;
  wifiLinkSpeedMbps?: number | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracy?: number | null;
  gpsAltMeters?: number | null;
  gpsSpeedMps?: number | null;
  gpsBearingDeg?: number | null;
  gpsProvider?: string | null;
  placeName?: string | null;
  addressLine?: string | null;
  district?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
  postalCode?: string | null;
  storageFreeMb?: number | null;
  storageTotalMb?: number | null;
  ramAvailMb?: number | null;
  ramTotalMb?: number | null;
  uptimeSec?: number | null;
  powerSaveMode?: boolean | null;
  deviceInteractive?: boolean | null;
  screenOn?: boolean | null;
  cpuCores?: number | null;
  cpuUsagePct?: number | null;
  deviceTempC?: number | null;
  osVersion?: string | null;
  sdkInt?: number | null;
  agentVersion?: string | null;
  appPackage?: string | null;
  appVersionName?: string | null;
  appVersionCode?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  brand?: string | null;
  device?: string | null;
  product?: string | null;
  hardware?: string | null;
  board?: string | null;
  cardReadsSinceBoot?: number | null;
  transactionsSinceBoot?: number | null;
  errorsSinceBoot?: number | null;
  lastCardReadAt?: string | null;
  lastTransactionAt?: string | null;
  extraJson?: string | null;
};

export type TelemetryPushRequest = {
  serialNumber?: string | null;
  imei1?: string | null;
  imei2?: string | null;
  iccid?: string | null;
  androidId?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  brand?: string | null;
  device?: string | null;
  product?: string | null;
  hardware?: string | null;
  board?: string | null;
  batteryPercent?: number | null;
  charging?: boolean | null;
  batteryTemp?: number | null;
  batteryVoltageMv?: number | null;
  batteryHealth?: string | null;
  chargePlug?: string | null;
  networkType?: NetworkType | null;
  signalLevel?: number | null;
  ipAddress?: string | null;
  publicIp?: string | null;
  carrierName?: string | null;
  carrierMccMnc?: string | null;
  roaming?: boolean | null;
  simOperatorName?: string | null;
  simCountryIso?: string | null;
  wifiSsid?: string | null;
  wifiBssid?: string | null;
  wifiRssi?: number | null;
  wifiLinkSpeedMbps?: number | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracy?: number | null;
  gpsAltMeters?: number | null;
  gpsSpeedMps?: number | null;
  gpsBearingDeg?: number | null;
  gpsProvider?: string | null;
  placeName?: string | null;
  addressLine?: string | null;
  district?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
  postalCode?: string | null;
  storageFreeMb?: number | null;
  storageTotalMb?: number | null;
  ramAvailMb?: number | null;
  ramTotalMb?: number | null;
  uptimeSec?: number | null;
  powerSaveMode?: boolean | null;
  deviceInteractive?: boolean | null;
  screenOn?: boolean | null;
  cpuCores?: number | null;
  cpuUsagePct?: number | null;
  deviceTempC?: number | null;
  osVersion?: string | null;
  sdkInt?: number | null;
  agentVersion?: string | null;
  appPackage?: string | null;
  appVersionName?: string | null;
  appVersionCode?: string | null;
  cardReadsSinceBoot?: number | null;
  transactionsSinceBoot?: number | null;
  errorsSinceBoot?: number | null;
  lastCardReadAtIso?: string | null;
  lastTransactionAtIso?: string | null;
  extraJson?: string | null;
};

export type AlertResponse = {
  id: number;
  terminalId: number;
  type: EventType;
  severity: EventSeverity;
  message?: string | null;
  eventTimestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
};

export type EventLogRequest = {
  terminalId: number;
  type: EventType;
  severity: EventSeverity;
  message?: string | null;
  metaJson?: string | null;
  eventTimestamp?: string | null;
};

export type IncidentResponse = {
  id: number;
  terminalId?: number | null;
  status: IncidentStatus;
  titre: string;
  description?: string | null;
  assignedTo?: string | null;
  slaDeadline?: string | null;
  timelineJson?: string | null;
  commentsJson?: string | null;
  eventLogId?: number | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CreateIncidentRequest = {
  terminalId?: number | null;
  titre: string;
  description?: string | null;
  assignedTo?: string | null;
  slaDeadline?: string | null;
  eventLogId?: number | null;
};

export type UpdateIncidentRequest = {
  status?: IncidentStatus | null;
  assignedTo?: string | null;
  description?: string | null;
  comment?: string | null;
};

export type SiteResponse = {
  id: number;
  nom: string;
  localisation?: string | null;
  zone?: string | null;
  ville?: string | null;
  region?: string | null;
  pays?: string | null;
  contactsJson?: string | null;
  tags?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  actif: boolean;
};

export type CreateSiteRequest = {
  nom: string;
  localisation?: string | null;
  zone?: string | null;
  ville?: string | null;
  region?: string | null;
  pays?: string | null;
  contactsJson?: string | null;
  tags?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
};

export type MovementAlert = {
  id: number;
  terminalId: number;
  triggeredAt: string;
  resolvedAt?: string | null;
  currentLat: number;
  currentLng: number;
  distanceFromBase: number;
  alertThreshold: number;
  status: MovementAlertStatus;
};

export type TerminalConnectionHistoryResponse = {
  id: number;
  terminalId: number;
  eventType: TerminalConnectionEventType;
  connectedAt: string;
  disconnectedAt?: string | null;
  source?: string | null;
};

export type FullHistoryResponse = {
  terminal: Terminal;
  positions: PageResponse<TelemetrySnapshot>;
  movementAlerts: PageResponse<MovementAlert>;
  transactions: PageResponse<TelemetrySnapshot>;
  events: PageResponse<AlertResponse>;
  connectionHistory: PageResponse<TerminalConnectionHistoryResponse>;
};

export type PageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
};

export type ApiErrorShape = {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
};

export type LocalTelemetry = {
  serialNumber: string;
  imei1?: string | null;
  imei2?: string | null;
  androidId?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  brand?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  batteryPercent?: number | null;
  charging?: boolean | null;
  batteryTemp?: number | null;
  networkType?: NetworkType | null;
  signalLevel?: number | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracy?: number | null;
  storageFreeMb?: number | null;
  uptimeSec?: number | null;
  osVersion?: string | null;
  agentVersion?: string;
};
