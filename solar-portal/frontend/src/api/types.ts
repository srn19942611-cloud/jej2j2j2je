export type SiteStatus = "normal" | "underperforming" | "offline";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface FleetSiteStatus {
  site_id: string;
  code: string;
  name: string;
  lat: number;
  lon: number;
  status: SiteStatus;
  today_actual_kwh: number;
  today_expected_kwh: number;
  current_pr: number | null;
  last_update: string | null;
  open_alert_count: number;
}

export interface FleetOverview {
  sites: FleetSiteStatus[];
  generated_at: string;
}

export interface SiteOut {
  id: string;
  code: string;
  name: string;
  lat: number;
  lon: number;
  timezone: string;
  nameplate_kwp: number;
  tilt_deg: number;
  azimuth_deg: number;
  inverter_ac_rating_kw: number;
  string_count: number;
  installed_at: string | null;
}

export interface ProductionPoint {
  ts: string;
  ac_power_w: number | null;
  dc_power_w: number | null;
  expected_ac_power_w: number | null;
  pr: number | null;
}

export interface PrAggregatePoint {
  period_start: string;
  actual_kwh: number | null;
  expected_kwh: number | null;
  pr: number | null;
  degradation_flag: boolean;
}

export interface WeatherPoint {
  ts: string;
  ghi_w_m2: number | null;
  temp_air_c: number | null;
  cloud_cover_pct: number | null;
}

export interface StringPoint {
  ts: string;
  string_id: string;
  dc_power_w: number | null;
}

export interface AlertOut {
  id: string;
  site_id: string;
  site_name: string;
  string_id: string | null;
  created_at: string;
  severity: AlertSeverity;
  category: string;
  message_da: string;
  suggested_cause_da: string;
  confidence: number | null;
  status: AlertStatus;
  source_agent: string;
}

export interface FeedHealthOut {
  connector_config_id: string;
  site_id: string;
  site_name: string;
  platform: string;
  status: "healthy" | "stale" | "down";
  last_attempt_at: string | null;
  last_success_at: string | null;
  consecutive_failures: number;
  last_error: string | null;
}
