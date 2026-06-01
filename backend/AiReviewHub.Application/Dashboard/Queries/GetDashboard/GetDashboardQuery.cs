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
        IReadOnlyList<StatusStat> StatusStats,
        IReadOnlyList<ProjectStat> ProjectStats,
        AutoInsights? AutoInsights,
        bool HasAnyFeedbacks,
        bool HasDataInPeriod
    );

    public record DashboardStats(
        int TotalFeedbacks,      // ← sur la période (plus l'historique)
        int TodoCount,
        int InProgressCount,
        int ResolvedCount,
        int HighPriorityCount,
        int PendingAiCount,
        double ResolvedRate,
        int PreviousPeriodTotal, 
        double? GrowthPercent,       
        double? PreviousResolvedRate,
        double? ResolvedRateDelta,   
        double AveragePerDay,            
        double? AverageResolutionDays
    );

    public record StatusStat(string Status, int Count, double Percent); // ← NOUVEAU

    public record AutoInsights(IReadOnlyList<string> Bullets, IReadOnlyList<string> Insights);

    // CategoryStat, ProjectStat, TrendPoint, DashboardFeedbackDto inchangés
    public record TrendPoint(string Date, int Count);

    public record CategoryStat(string Category, int Count, double Percent, int PreviousCount, double? Delta);

    public record ProjectStat(
        Guid ProjectId,            
        string ProjectName,
        int FeedbackCount
    );

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
