export type FeedbackStatus = 'Todo' | 'InProgress' | 'Done';
export type FeedbackPriority = 'Low' | 'Normal' | 'High' | 'Critical';
export type FeedbackCategory = 'Bug' | 'FeatureRequest' | 'Question' | 'Uncategorized';
export type AiStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed';
export type SortBy = 'recent' | 'oldest' | 'priority' | 'score' | 'action';

export interface Feedback {
    id: string;
    content: string;
    aiSummary: string;
    category: FeedbackCategory;
    priority: FeedbackPriority;
    status: FeedbackStatus;
    aiAnalysisStatus: AiStatus;
    // Champs Pro
    priorityScore?: number;
    sentiment?: string;
    sentimentScore?: number;
    keyTopics?: string[];
    actionRequired?: boolean;
    urgency?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface FeedbackFilters {
    search: string;
    page: number;
    pageSize: number;
    status?: FeedbackStatus;
    category?: FeedbackCategory;
    priority?: FeedbackPriority;
    sortBy?: SortBy;
    actionRequired?: boolean;
    sentiment?: string;
    minScore?: number;
}

export interface PagedResult<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
}