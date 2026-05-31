using AiReviewHub.Application.Abstractions;
using AiReviewHub.Application.Dashboard.Queries.GetDashboard;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Entities;
using AiReviewHub.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
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

            // Période précédente pour le calcul de croissance
            var prevFrom = from.AddDays(-request.Days);
            var prevTo = from;

            // ── Base query ──────────────────────────────────────────
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
                    ProjectId  = f.ProjectId,
                    ProjectName = f.Project.Name
                })
                .ToListAsync(cancellationToken);

            // ── Période précédente — COUNT uniquement ───────────────
            // Une seule agrégation SQL, pas de chargement en mémoire
            var previousCount = await baseQuery
                .Where(f => f.CreatedAt >= prevFrom && f.CreatedAt < prevTo)
                .CountAsync(cancellationToken);

            // ── État vide sur la période ────────────────────────────
            var hasAnyFeedbacks = await baseQuery.AnyAsync(cancellationToken);
            var hasDataInPeriod = periodFeedbacks.Any();


            // ── Stats ───────────────────────────────────────────────
            var total = periodFeedbacks.Count;
            var resolved = periodFeedbacks.Count(f => f.Status == FeedbackStatus.Done);

            double? growthPercent = previousCount == 0
                ? null                                                           
                : Math.Round((double)(total - previousCount) / previousCount * 100, 1);

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
                ResolvedRate: total > 0 ? Math.Round((double)resolved / total * 100, 1) : 0,
                PreviousPeriodTotal: previousCount,
                GrowthPercent: growthPercent
            );

            var countByDate = periodFeedbacks
                .GroupBy(f => f.CreatedAt.Date)
                .ToDictionary(g => g.Key, g => g.Count());


            // ── Tendances par jour ──────────────────────────────────
            var trends = Enumerable
                .Range(0, request.Days)
                .Select(offset => from.Date.AddDays(offset))
                .Where(date => date <= now.Date)
                .Select(date => new TrendPoint(
                    date.ToString("yyyy-MM-dd"),
                    countByDate.TryGetValue(date, out var count) ? count : 0))
                .ToList();

            // ── Stats par catégorie ─────────────────────────────────
            var categoryStats = periodFeedbacks
                .GroupBy(f => f.Category)
                .OrderByDescending(g => g.Count())
                .Select(g => new CategoryStat(
                    g.Key.ToString(),
                    g.Count(),
                    total > 0 ? Math.Round((double)g.Count() / total * 100, 1) : 0))
                .ToList();

            // ── Projets les plus actifs ─────────────────────────────
            var projectStats = periodFeedbacks
                .GroupBy(f => new { f.ProjectId, f.ProjectName })
                .OrderByDescending(g => g.Count())
                .Take(5)
                .Select(g => new ProjectStat(g.Key.ProjectId, g.Key.ProjectName, g.Count()))
                .ToList();

            // ── Synthèse automatique (renommée) ─────────────────────
            AutoInsights? autoInsights = null;
            if (categoryStats.Any())
            {
                var bullets = categoryStats
                    .Take(4)
                    .Select(c => $"{c.Percent}% des retours concernent {GetCategoryLabel(c.Category)}")
                    .ToList<string>();

                if (growthPercent != 0)
                {
                    var direction = growthPercent > 0 ? "augmenté" : "diminué";
                    bullets.Add($"Le volume de feedbacks a {direction} de {Math.Abs(growthPercent)}% vs la période précédente");
                }

                autoInsights = new AutoInsights(bullets);
            }

            // ── Feedbacks récents ───────────────────────────────────
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
                categoryStats, projectStats,
                autoInsights hasDataInPeriod);
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


