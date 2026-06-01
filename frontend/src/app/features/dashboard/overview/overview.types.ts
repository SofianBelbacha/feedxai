export interface DashboardStats {
  totalFeedbacks: number;
  todoCount: number;
  inProgressCount: number;
  resolvedCount: number;
  highPriorityCount: number;
  pendingAiCount: number;
  resolvedRate: number;
  previousPeriodTotal: number;
  growthPercent: number | null;
  previousResolvedRate: number | null;
  resolvedRateDelta: number | null;
  averagePerDay: number;
  averageResolutionDays: number | null;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface CategoryStat {
  category: string;
  count: number;
  percent: number;
  previousCount: number;
  delta: number | null;
}

export interface StatusStat {
  status: string;
  count: number;
  percent: number;
}

export interface ProjectStat {
  projectId: string;
  projectName: string;
  feedbackCount: number;
}

export interface AutoInsights {
  bullets: string[];
  insights: string[];
}

export interface RecentFeedback {
  id: string;
  content: string;
  aiSummary: string | null;
  category: string;
  priority: string;
  status: string;
  aiAnalysisStatus: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  createdAt: string;
}