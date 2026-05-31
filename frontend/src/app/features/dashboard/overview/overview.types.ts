export interface DashboardStats {
  totalFeedbacks: number;
  todoCount: number;
  inProgressCount: number;
  resolvedCount: number;
  highPriorityCount: number;
  pendingAiCount:    number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface CategoryStat {
  category: string;
  count:    number;
  percent:  number;
}

export interface ProjectStat {
  projectName:   string;
  feedbackCount: number;
}

export interface AiInsights {
  bullets: string[];
}


export interface RecentFeedback {
  id: string;
  content: string;
  aiSummary: string;
  category: string;
  priority: string;
  status: string;
  aiAnalysisStatus: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  createdAt: string;
}