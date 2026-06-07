using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Trends.Queries.GetTrends
{
    public record GetTrendsQuery(
        int Days = 30,
        Guid? ProjectId = null,
        string? Category = null,
        string? Priority = null
    ) : IRequest<GetTrendsResult>;

    public record GetTrendsResult(
        VolumeEvolution Volume,
        IReadOnlyList<CategoryEvolution> Categories,
        IReadOnlyList<CategoryEvolution> EmergingCategories,
        IReadOnlyList<ProjectEvolution> TopProjects,
        BacklogHealth Backlog,
        ResolutionMetrics Resolution,
        IReadOnlyList<PriorityPoint> PriorityTrend,
        PriorityEvolution PriorityEvolution,  
        IReadOnlyList<TrendInsight> Insights,  
        IReadOnlyList<AutoAlert> Alerts,
        IReadOnlyList<HeatmapCell> Heatmap
    );

    // ── Volume evolution ─────────────────────────────────────────────────────────

    public record VolumeEvolution(
        IReadOnlyList<SeriesPoint> Received,   // feedbacks reçus par jour
        IReadOnlyList<SeriesPoint> Resolved,   // feedbacks résolus par jour
        int CurrentTotal,
        int PreviousTotal,
        double? GrowthPercent,
        double AveragePerDay,
        int CurrentResolved,
        int PreviousResolved,
        double? ResolvedGrowthPercent
    );

    public record SeriesPoint(string Date, int Count);

    // ── Category evolution ────────────────────────────────────────────────────────

    public record CategoryEvolution(
        string Category,
        int CurrentCount,
        int PreviousCount,
        double CurrentPercent,
        double? Delta,            // variation % vs période précédente
        bool IsEmerging        // nouveau signal
    );

    // ── Project evolution ─────────────────────────────────────────────────────────

    public record ProjectEvolution(
        Guid ProjectId,
        string ProjectName,
        int CurrentCount,
        int PreviousCount,
        double? GrowthPercent
    );

    // ── Backlog health ────────────────────────────────────────────────────────────

    public record BacklogHealth(
        int OpenCount,          // Todo + InProgress
        int ResolvedCount,
        double ResolutionRatio,    // resolved / created (idéal >= 1)
        double AverageAgeDays,     // âge moyen des feedbacks ouverts non résolus
        int OldestOpenDays      // feedback ouvert le plus ancien
    );

    // ── Resolution metrics ────────────────────────────────────────────────────────

    public record ResolutionMetrics(
        double? AverageResolutionDays,
        double? PreviousAverageResolutionDays,
        double? Delta,                      // variation en jours
        IReadOnlyList<SeriesPoint> DailyAverages              // courbe temporelle
    );

    // ── Priority trend ────────────────────────────────────────────────────────────

    public record PriorityPoint(
        string Date,
        int Critical,
        int High,
        int Normal,
        int Low
    );

    // ── Auto alerts ───────────────────────────────────────────────────────────────

    public record AutoAlert(
        string AlertType,   // "danger" | "warning" | "info"
        string Message
    );

    // ── Priority evolution ────────────────────────────────────────────────────────

    public record PriorityEvolution(
        int CurrentCritical,
        int CurrentHigh,
        int CurrentNormal,
        int CurrentLow,
        int PreviousCritical,
        int PreviousHigh,
        int PreviousNormal,
        int PreviousLow,
        double? CriticalDelta,    // variation % vs période précédente
        double? HighDelta,
        double? NormalDelta,
        double? LowDelta
    );

    // ── Trend insights ────────────────────────────────────────────────────────────

    public record TrendInsight(
        string Title,
        string Description,
        InsightType Type,          // Rising | Falling | Emerging | Stable | Warning
        double Confidence,    // 0.0 - 1.0
        string? Category,
        double? Delta
    );

    public enum InsightType
    {
        Rising,
        Falling,
        Emerging,
        Stable,
        Warning
    }

    public record HeatmapCell(
    int DayOfWeek,  // 0 = Lundi … 6 = Dimanche
    int Hour,       // 0 … 23
    int Count
);

}
