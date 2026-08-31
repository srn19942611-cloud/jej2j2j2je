import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "./client";
import type {
  AlertOut,
  FeedHealthOut,
  FleetOverview,
  PrAggregatePoint,
  ProductionPoint,
  SiteOut,
  StringPoint,
  WeatherPoint,
} from "./types";

export function useFleetOverview() {
  return useQuery({
    queryKey: ["fleet-overview"],
    queryFn: () => apiGet<FleetOverview>("/fleet/overview"),
    refetchInterval: 60_000,
  });
}

export function useSites() {
  return useQuery({
    queryKey: ["sites"],
    queryFn: () => apiGet<SiteOut[]>("/sites"),
  });
}

export function useSite(siteId: string | undefined) {
  return useQuery({
    queryKey: ["site", siteId],
    queryFn: () => apiGet<SiteOut>(`/sites/${siteId}`),
    enabled: !!siteId,
  });
}

export function useSiteProduction(siteId: string | undefined, days = 14) {
  return useQuery({
    queryKey: ["site-production", siteId, days],
    queryFn: () => {
      const end = new Date();
      const start = new Date(end.getTime() - days * 86400_000);
      return apiGet<ProductionPoint[]>(
        `/sites/${siteId}/production?start=${start.toISOString()}&end=${end.toISOString()}`
      );
    },
    enabled: !!siteId,
  });
}

export function useSitePrTrend(siteId: string | undefined, period: "daily" | "weekly" | "monthly") {
  return useQuery({
    queryKey: ["site-pr-trend", siteId, period],
    queryFn: () => apiGet<PrAggregatePoint[]>(`/sites/${siteId}/pr-trend?period=${period}`),
    enabled: !!siteId,
  });
}

export function useSiteWeather(siteId: string | undefined, days = 14) {
  return useQuery({
    queryKey: ["site-weather", siteId, days],
    queryFn: () => {
      const end = new Date();
      const start = new Date(end.getTime() - days * 86400_000);
      return apiGet<WeatherPoint[]>(`/sites/${siteId}/weather?start=${start.toISOString()}&end=${end.toISOString()}`);
    },
    enabled: !!siteId,
  });
}

export function useSiteStrings(siteId: string | undefined, days = 7) {
  return useQuery({
    queryKey: ["site-strings", siteId, days],
    queryFn: () => {
      const end = new Date();
      const start = new Date(end.getTime() - days * 86400_000);
      return apiGet<StringPoint[]>(`/sites/${siteId}/strings?start=${start.toISOString()}&end=${end.toISOString()}`);
    },
    enabled: !!siteId,
  });
}

export function useSiteAlerts(siteId: string | undefined) {
  return useQuery({
    queryKey: ["site-alerts", siteId],
    queryFn: () => apiGet<AlertOut[]>(`/sites/${siteId}/alerts`),
    enabled: !!siteId,
  });
}

export function useAlerts(filters: { severity?: string; status?: string }) {
  return useQuery({
    queryKey: ["alerts", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.severity) params.set("severity", filters.severity);
      if (filters.status) params.set("status", filters.status);
      const qs = params.toString();
      return apiGet<AlertOut[]>(`/alerts${qs ? `?${qs}` : ""}`);
    },
    refetchInterval: 30_000,
  });
}

export function useFeedHealth() {
  return useQuery({
    queryKey: ["feed-health"],
    queryFn: () => apiGet<FeedHealthOut[]>("/feed-health"),
    refetchInterval: 60_000,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => apiPost<AlertOut>(`/alerts/${alertId}/acknowledge`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["site-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["fleet-overview"] });
    },
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => apiPost<AlertOut>(`/alerts/${alertId}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["site-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["fleet-overview"] });
    },
  });
}
