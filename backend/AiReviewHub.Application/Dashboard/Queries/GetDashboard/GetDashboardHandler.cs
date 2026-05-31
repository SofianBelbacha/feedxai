using AiReviewHub.Application.Abstractions;
using AiReviewHub.Application.Dashboard.Queries.GetDashboard;
using AiReviewHub.Domain.Abstractions;
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

        public async Task<GetDashboardResult> Handle(
            GetDashboardQuery request,
            CancellationToken cancellationToken)
        {
            var userId = _currentUser.UserId;
            var now = _dateTimeProvider.UtcNow;
            var from = now.AddDays(-request.Days);

            // ── Base query ───────────────────────────────────────────
            var baseQuery = _context.Feedbacks
                .AsNoTracking()
                .Where(f => f.Project.UserId == userId);

            if (request.ProjectId.HasValue)
                baseQuery = baseQuery.Where(f => f.ProjectId == request.ProjectId.Value);

            // ── Feedbacks sur la période demandée ────────────────────
            var periodQuery = baseQuery.Where(f => f.CreatedAt >= from);

            var periodFeedbacks = await periodQuery
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
                    ProjectName = f.Project.Name
                })
                .ToListAsync(cancellationToken);

            // ── Stats ─────────────────────────────────────────────────
            var stats = new DashboardStats(
                TotalFeedbacks: await baseQuery.CountAsync(cancellationToken),
                TodoCount: periodFeedbacks.Count(f => f.Status == FeedbackStatus.Todo),
                InProgressCount: periodFeedbacks.Count(f => f.Status == FeedbackStatus.InProgress),
                ResolvedCount: periodFeedbacks.Count(f => f.Status == FeedbackStatus.Done),
                HighPriorityCount: periodFeedbacks.Count(f =>
                    f.Priority == FeedbackPriority.High ||
                    f.Priority == FeedbackPriority.Critical),
                PendingAiCount: periodFeedbacks.Count(f =>
                    f.AiAnalysisStatus == AiAnalysisStatus.Pending ||
                    f.AiAnalysisStatus == AiAnalysisStatus.Failed)
            );

            // ── Tendances par jour ────────────────────────────────────
            var trends = periodFeedbacks
                .GroupBy(f => f.CreatedAt.Date)
                .OrderBy(g => g.Key)
                .Select(g => new TrendPoint(g.Key.ToString("yyyy-MM-dd"), g.Count()))
                .ToList();

            // ── Stats par catégorie ───────────────────────────────────
            var total = periodFeedbacks.Count;
            var categoryStats = periodFeedbacks
                .GroupBy(f => f.Category)
                .OrderByDescending(g => g.Count())
                .Select(g => new CategoryStat(
                    g.Key.ToString(),
                    g.Count(),
                    total > 0 ? Math.Round((double)g.Count() / total * 100, 1) : 0))
                .ToList();

            // ── Projets les plus actifs ───────────────────────────────
            var projectStats = periodFeedbacks
                .GroupBy(f => f.ProjectName)
                .OrderByDescending(g => g.Count())
                .Take(5)
                .Select(g => new ProjectStat(g.Key, g.Count()))
                .ToList();

            // ── AI Insights — synthèse des AiSummary disponibles ─────
            // Simple agrégation textuelle pour le MVP
            // À terme : appel OpenAI dédié sur les summaries groupés
            AiInsights? aiInsights = null;
            var completedSummaries = periodFeedbacks
                .Where(f => f.AiAnalysisStatus == AiAnalysisStatus.Completed
                         && !string.IsNullOrEmpty(f.AiSummary))
                .Take(50)
                .ToList();

            if (completedSummaries.Any())
            {
                var bullets = categoryStats
                    .Take(4)
                    .Select(c => $"{c.Percent}% des retours concernent la catégorie {c.Category}")
                    .ToList();

                aiInsights = new AiInsights(bullets);
            }

            // ── Feedbacks récents ─────────────────────────────────────
            var recentDtos = periodFeedbacks
                .OrderByDescending(f => f.CreatedAt)
                .Take(10)
                .Select(f => new DashboardFeedbackDto(
                    f.Id, f.Content, f.AiSummary,
                    f.Category.ToString(), f.Priority.ToString(),
                    f.Status.ToString(), f.AiAnalysisStatus.ToString(),
                    f.CreatedAt))
                .ToList();

            return new GetDashboardResult(stats, trends, recentDtos, categoryStats, projectStats, aiInsights);
        }
    }
}

