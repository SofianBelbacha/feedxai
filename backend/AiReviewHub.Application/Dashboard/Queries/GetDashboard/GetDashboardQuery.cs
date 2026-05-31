using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Dashboard.Queries.GetDashboard
{
    public record GetDashboardQuery(
        Guid? ProjectId = null,
        int Days = 30          // ← période : 7, 30, 90
    ) : IRequest<GetDashboardResult>;

    public record GetDashboardResult(
        DashboardStats Stats,
        IReadOnlyList<TrendPoint> Trends,
        IReadOnlyList<DashboardFeedbackDto> RecentFeedbacks,
        IReadOnlyList<CategoryStat> CategoryStats,  
        IReadOnlyList<ProjectStat> ProjectStats,    
        AiInsights? AiInsights  
    );

    public record DashboardStats(
        int TotalFeedbacks,
        int TodoCount,
        int InProgressCount,
        int ResolvedCount,
        int HighPriorityCount,
        int PendingAiCount    
    );

    public record TrendPoint(string Date, int Count);

    public record CategoryStat(string Category, int Count, double Percent);

    public record ProjectStat(string ProjectName, int FeedbackCount);

    public record AiInsights(IReadOnlyList<string> Bullets);

    public record DashboardFeedbackDto(
        Guid Id,
        string Content,
        string? AiSummary,
        string Category,
        string Priority,
        string Status,
        string AiAnalysisStatus,
        DateTime CreatedAt
    );
}
