using AiReviewHub.Application.Abstractions;
using AiReviewHub.Application.Dashboard.Queries.GetDashboard;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Entities;
using AiReviewHub.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Stripe.Forwarding;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Dashboard.Queries.GetDashboard
{
    public class GetDashboardHandler : IRequestHandler<GetDashboardQuery, GetDashboardResult>
    {
        private readonly IAppDbContext _context;
        private readonly ICurrentUserService _currentUser;
        private readonly IDateTimeProvider _dateTimeProvider;

        public GetDashboardHandler(
            IAppDbContext context,
            ICurrentUserService currentUser,
            IDateTimeProvider dateTimeProvider)
        {
            _context = context;
            _currentUser = currentUser;
            _dateTimeProvider = dateTimeProvider;
        }

        public async Task<GetDashboardResult> Handle(GetDashboardQuery request, CancellationToken cancellationToken)
        {
            var userId = _currentUser.UserId;
            var now = _dateTimeProvider.UtcNow;
            var from = now.AddDays(-request.Days);
            var prevFrom = from.AddDays(-request.Days);
            var prevTo = from;

            var baseQuery = _context.Feedbacks
                .AsNoTracking()
                .Where(f => f.Project.UserId == userId);

            if (request.ProjectId.HasValue)
                baseQuery = baseQuery.Where(f => f.ProjectId == request.ProjectId.Value);

            // ── Période courante ────────────────────────────────────
            var periodFeedbacks = await baseQuery
                .Where(f => f.CreatedAt >= from)
                .Select(f => new
                {
                    f.Id,
                    Content = f.Content.Value,
                    AiSummary = f.AiSummary,
                    Category = f.Category,
                    Priority = f.Priority,
                    Status = f.Status,
                    AiAnalysisStatus = f.AiAnalysisStatus,
                    f.CreatedAt,
                    f.ResolvedAt,     
                    ProjectId = f.ProjectId,
                    ProjectName = f.Project.Name
                })
                .ToListAsync(cancellationToken);

            // ── Période précédente — stats pour comparaison ─────────
            var previousFeedbacks = await baseQuery
                .Where(f => f.CreatedAt >= prevFrom && f.CreatedAt < prevTo)
                .Select(f => new
                {
                    f.Category,
                    f.Status,
                })
                .ToListAsync(cancellationToken);

            var hasAnyFeedbacks = await baseQuery.AnyAsync(cancellationToken);
            var hasDataInPeriod = periodFeedbacks.Any();

            // ── Stats de base ────────────────────────────────────────
            var total = periodFeedbacks.Count;
            var resolved = periodFeedbacks.Count(f => f.Status == FeedbackStatus.Done);
            var prevTotal = previousFeedbacks.Count;
            var prevResolved = previousFeedbacks.Count(f => f.Status == FeedbackStatus.Done);

            double? growthPercent = prevTotal == 0
                ? null
                : Math.Round((double)(total - prevTotal) / prevTotal * 100, 1);

            double resolvedRate = total > 0 ? Math.Round((double)resolved / total * 100, 1) : 0;
            double prevResolvedRate = prevTotal > 0 ? Math.Round((double)prevResolved / prevTotal * 100, 1) : 0;
            double? resolvedRateDelta = prevTotal > 0
                ? Math.Round(resolvedRate - prevResolvedRate, 1)
                : null;

            // Moyenne par jour
            var days = Math.Max(request.Days, 1);
            var averagePerDay = Math.Round((double)total / days, 1);

            // Temps moyen de résolution
            var resolutionTimes = periodFeedbacks
                .Where(f => f.ResolvedAt.HasValue)
                .Select(f => (f.ResolvedAt!.Value - f.CreatedAt).TotalDays)
                .ToList();
            double? averageResolutionDays = resolutionTimes.Any()
                ? Math.Round(resolutionTimes.Average(), 1)
                : null;

            var stats = new DashboardStats(
                TotalFeedbacks: total,
                TodoCount: periodFeedbacks.Count(f => f.Status == FeedbackStatus.Todo),
                InProgressCount: periodFeedbacks.Count(f => f.Status == FeedbackStatus.InProgress),
                ResolvedCount: resolved,
                HighPriorityCount: periodFeedbacks.Count(f =>
                    f.Priority == FeedbackPriority.High ||
                    f.Priority == FeedbackPriority.Critical),
                PendingAiCount: periodFeedbacks.Count(f =>
                    f.AiAnalysisStatus == AiAnalysisStatus.Pending ||
                    f.AiAnalysisStatus == AiAnalysisStatus.Failed),
                ResolvedRate: resolvedRate,
                PreviousPeriodTotal: prevTotal,
                GrowthPercent: growthPercent,
                PreviousResolvedRate: prevTotal > 0 ? prevResolvedRate : null,
                ResolvedRateDelta: resolvedRateDelta,
                AveragePerDay: averagePerDay,
                AverageResolutionDays: averageResolutionDays
            );

            // ── Trends — série complète sans trous ───────────────────
            var countByDate = periodFeedbacks
                .GroupBy(f => f.CreatedAt.Date)
                .ToDictionary(g => g.Key, g => g.Count());

            var trends = Enumerable.Range(0, request.Days)
                .Select(offset => from.Date.AddDays(offset))
                .Where(date => date <= now.Date)
                .Select(date => new TrendPoint(
                    date.ToString("yyyy-MM-dd"),
                    countByDate.TryGetValue(date, out var c) ? c : 0))
                .ToList();

            // ── Status stats — pour le donut ─────────────────────────
            var statusStats = new List<StatusStat>
            {
                new("Todo",       stats.TodoCount,       total > 0 ? Math.Round((double)stats.TodoCount       / total * 100, 1) : 0),
                new("InProgress", stats.InProgressCount, total > 0 ? Math.Round((double)stats.InProgressCount / total * 100, 1) : 0),
                new("Done",       stats.ResolvedCount,   total > 0 ? Math.Round((double)stats.ResolvedCount   / total * 100, 1) : 0),
            };

            // ── Category stats enrichies ─────────────────────────────
            var prevCountByCategory = previousFeedbacks
                .GroupBy(f => f.Category)
                .ToDictionary(g => g.Key, g => g.Count());

            var categoryStats = periodFeedbacks
                .GroupBy(f => f.Category)
                .OrderByDescending(g => g.Count())
                .Select(g =>
                {
                    var count = g.Count();
                    var prevCount = prevCountByCategory.TryGetValue(g.Key, out var pc) ? pc : 0;
                    var delta = prevCount > 0
                        ? (double?)(Math.Round((double)(count - prevCount) / prevCount * 100, 1))
                        : null;
                    return new CategoryStat(
                        g.Key.ToString(), count,
                        total > 0 ? Math.Round((double)count / total * 100, 1) : 0,
                        prevCount, delta);
                })
                .ToList();

            // ── Project stats ────────────────────────────────────────
            var projectStats = periodFeedbacks
                .GroupBy(f => new { f.ProjectId, f.ProjectName })
                .OrderByDescending(g => g.Count())
                .Take(5)
                .Select(g => new ProjectStat(g.Key.ProjectId, g.Key.ProjectName, g.Count()))
                .ToList();

            // ── AutoInsights — descriptif + comparatif ───────────────
            AutoInsights? autoInsights = null;
            if (categoryStats.Any())
            {
                var bullets = categoryStats
                    .Take(4)
                    .Select(c => $"{c.Percent}% des retours concernent {GetCategoryLabel(c.Category)}")
                    .ToList();

                // Insights comparatifs — tendances émergentes
                var insights = new List<string>();

                foreach (var cat in categoryStats.Where(c => c.Delta.HasValue))
                {
                    if (cat.Delta > 40)
                        insights.Add($"Les {GetCategoryLabel(cat.Category)} ont augmenté de {cat.Delta}% vs la période précédente");
                    else if (cat.Delta< -30)
                        insights.Add($"Les {GetCategoryLabel(cat.Category)} ont diminué de {Math.Abs(cat.Delta!.Value)}% vs la période précédente");
                }

                // Nouvelle catégorie apparue
                var newCategories = categoryStats
                    .Where(c => c.PreviousCount == 0 && c.Count >= 3)
                    .ToList();
                foreach (var cat in newCategories)
                    insights.Add($"Nouvelle tendance détectée : {GetCategoryLabel(cat.Category)} ({cat.Count} retours)");

                if (growthPercent.HasValue && Math.Abs(growthPercent.Value) > 20)
                {
                    var dir = growthPercent > 0 ? "augmenté" : "diminué";
                    insights.Add($"Le volume global a {dir} de {Math.Abs(growthPercent.Value)}% vs la période précédente");
                } 

                autoInsights = new AutoInsights(bullets, insights);
            }

            // ── Recent feedbacks ─────────────────────────────────────
            var recentDtos = periodFeedbacks
                .OrderByDescending(f => f.CreatedAt)
                .Take(10)
                .Select(f => new DashboardFeedbackDto(
                    f.Id, f.Content, f.AiSummary,
                    f.Category.ToString(), f.Priority.ToString(),
                    f.Status.ToString(), f.AiAnalysisStatus.ToString(),
                    f.CreatedAt))
                .ToList();

            return new GetDashboardResult(
                stats, trends, recentDtos,
                categoryStats, statusStats, projectStats,
                autoInsights, hasAnyFeedbacks, hasDataInPeriod);
        }

        private static string GetCategoryLabel(string category) => category switch
        {
            "Bug" => "les bugs",
            "FeatureRequest" => "les demandes de fonctionnalités",
            "Question" => "les questions",
            _ => category.ToLower()
        };
    }
}


