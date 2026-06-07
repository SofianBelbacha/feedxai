export interface SeriesPoint {
  date: string;
  count: number;
}

export interface VolumeEvolution {
  received: SeriesPoint[];
  resolved: SeriesPoint[];
  currentTotal: number;
  previousTotal: number;
  growthPercent: number | null;
  averagePerDay: number;
  currentResolved: number;
  previousResolved: number;
  resolvedGrowthPercent: number | null;
}

export interface CategoryEvolution {
  category: string;
  currentCount: number;
  previousCount: number;
  currentPercent: number;
  delta: number | null;
  isEmerging: boolean;
}

export interface ProjectEvolution {
  projectId: string;
  projectName: string;
  currentCount: number;
  previousCount: number;
  growthPercent: number | null;
}

export interface BacklogHealth {
  openCount: number;
  resolvedCount: number;
  resolutionRatio: number;
  averageAgeDays: number;
  oldestOpenDays: number;
}

export interface ResolutionMetrics {
  averageResolutionDays: number | null;
  previousAverageResolutionDays: number | null;
  delta: number | null;
  dailyAverages: SeriesPoint[];
}

export interface PriorityPoint {
  date: string;
  critical: number;
  high: number;
  normal: number;
  low: number;
}

export interface AutoAlert {
  alertType: 'danger' | 'warning' | 'info';
  message: string;
}

export type InsightType = 'Rising' | 'Falling' | 'Emerging' | 'Stable' | 'Warning';

export interface TrendInsight {
  title: string;
  description: string;
  type: InsightType;
  confidence: number;       
  category: string | null;
  delta: number | null;
}

export interface PriorityEvolution {
  currentCritical: number;
  currentHigh: number;
  currentNormal: number;
  currentLow: number;
  previousCritical: number;
  previousHigh: number;
  previousNormal: number;
  previousLow: number;
  criticalDelta: number | null;
  highDelta: number | null;
  normalDelta: number | null;
  lowDelta: number | null;
}

export interface HeatmapCell {
  dayOfWeek: number;  // 0 = Lundi … 6 = Dimanche
  hour:      number;  // 0 … 23
  count:     number;
}

export interface TrendsData {
  volume: VolumeEvolution;
  categories: CategoryEvolution[];
  emergingCategories: CategoryEvolution[];
  topProjects: ProjectEvolution[];
  backlog: BacklogHealth;
  resolution: ResolutionMetrics;
  priorityTrend: PriorityPoint[];
  priorityEvolution: PriorityEvolution;
  insights: TrendInsight[];
  alerts: AutoAlert[];
  heatmap: HeatmapCell[];
}

export type PeriodDays = 7 | 30 | 90 | 180 | 365;