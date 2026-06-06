using AiReviewHub.Application.Abstractions;
using AiReviewHub.Application.Dashboard.Queries.GetDashboard;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Trends.Queries.GetTrends
{
    public class GetTrendsHandler : IRequestHandler<GetTrendsQuery, GetTrendsResult>
    {
        private readonly IAppDbContext _context;
        private readonly ICurrentUserService _currentUser;
        private readonly IDateTimeProvider _dateTime;

        public GetTrendsHandler(
            IAppDbContext context,
            ICurrentUserService currentUser,
            IDateTimeProvider dateTime)
        {
            _context = context;
            _currentUser = currentUser;
            _dateTime = dateTime;
        }

        internal sealed record DashboardFeedbackDataCurrent(
            Guid Id,
            FeedbackCategory Category,
            FeedbackPriority Priority,
            FeedbackStatus Status,
            DateTime CreatedAt,
            DateTime? ResolvedAt,
            Guid ProjectId,
            string ProjectName
        );

        internal sealed record DashboardFeedbackDataPrevious(
            FeedbackCategory Category,
            FeedbackStatus Status,
            DateTime CreatedAt,
            DateTime? ResolvedAt,
            Guid ProjectId,
            string ProjectName
        );

        public async Task<GetTrendsResult> Handle(GetTrendsQuery request, CancellationToken cancellationToken)
        {
            var userId = _currentUser.UserId;
            var now = _dateTime.UtcNow;
            var from = now.AddDays(-request.Days);
            var prevFrom = from.AddDays(-request.Days);
            var prevTo = from;

            // ── Base query ───────────────────────────────────────
            var baseQuery = _context.Feedbacks
                .AsNoTracking()
                .Where(f => f.Project.UserId == userId);

            if (request.ProjectId.HasValue)
                baseQuery = baseQuery.Where(f => f.ProjectId == request.ProjectId.Value);

            if (!string.IsNullOrEmpty(request.Category)
                && Enum.TryParse<FeedbackCategory>(request.Category, out var cat))
                baseQuery = baseQuery.Where(f => f.Category == cat);

            if (!string.IsNullOrEmpty(request.Priority)
                && Enum.TryParse<FeedbackPriority>(request.Priority, out var pri))
                baseQuery = baseQuery.Where(f => f.Priority == pri);

            // ── Chargement des deux périodes ─────────────────────
            var currentFeedbacks = await baseQuery
                .Where(f => f.CreatedAt >= from)
                .Select(f => new DashboardFeedbackDataCurrent(
                    f.Id,
                    f.Category,
                    f.Priority,
                    f.Status,
                    f.CreatedAt,
                    f.ResolvedAt,
                    f.ProjectId,
                    f.Project.Name
                ))
                .ToListAsync(cancellationToken);

            var previousFeedbacks = await baseQuery
                .Where(f => f.CreatedAt >= prevFrom && f.CreatedAt < prevTo)
                .Select(f => new DashboardFeedbackDataPrevious(f.Category, f.Status, f.CreatedAt, f.ResolvedAt, f.ProjectId, f.Project.Name ))
                .ToListAsync(cancellationToken);

            var days = Math.Max(request.Days, 1);

            // ── 1. Volume evolution ──────────────────────────────
            var volume = BuildVolumeEvolution(currentFeedbacks, previousFeedbacks, from, now, days);

            // ── 2. Category evolution ────────────────────────────
            var(categories, emerging) = BuildCategoryEvolution(currentFeedbacks, previousFeedbacks);

            // ── 3. Top projects ──────────────────────────────────
            var topProjects = BuildProjectEvolution(currentFeedbacks, previousFeedbacks);

            // ── 4. Backlog health ────────────────────────────────
            var backlog = BuildBacklogHealth(currentFeedbacks, now);

            // ── 5. Resolution metrics ────────────────────────────
            var resolution = BuildResolutionMetrics(currentFeedbacks, previousFeedbacks, from, now);

            // ── 6. Priority trend ────────────────────────────────
            var priorityTrend = BuildPriorityTrend(currentFeedbacks, from, now);

            // ── 7. Auto alerts ───────────────────────────────────
            var alerts = BuildAlerts(categories, backlog, resolution, volume);

            return new GetTrendsResult(
                volume, categories, emerging,
                topProjects, backlog, resolution,
                priorityTrend, alerts);
        }

        // ── Builders ─────────────────────────────────────────────────────────────

        private static VolumeEvolution BuildVolumeEvolution(IReadOnlyList<DashboardFeedbackDataCurrent> current, IReadOnlyList<DashboardFeedbackDataPrevious> previous, DateTime from, DateTime now, int days)
        {
            var countByDate = current.GroupBy(f => f.CreatedAt.Date).ToDictionary(g => g.Key, g => g.Count());
            var resolvedByDate = current.Where(f => f.ResolvedAt.HasValue).GroupBy(f => f.ResolvedAt!.Value.Date).ToDictionary(g => g.Key, g => g.Count());

            var received = Enumerable.Range(0, days)
                .Select(i => from.Date.AddDays(i))
                .Where(d => d <= now.Date)
                .Select(d => new SeriesPoint(
                    d.ToString("yyyy-MM-dd"),
                    countByDate.TryGetValue(d, out var c) ? c : 0))
                .ToList();

            var resolved = Enumerable.Range(0, days)
                .Select(i => from.Date.AddDays(i))
                .Where(d => d <= now.Date)
                .Select(d => new SeriesPoint(
                    d.ToString("yyyy-MM-dd"),
                    resolvedByDate.TryGetValue(d, out var c) ? c : 0))
                .ToList();

            var currentTotal = current.Count;
            var previousTotal = previous.Count;
            var currentResolved = current.Count(f => f.Status == FeedbackStatus.Done);
            var previousResolved = previous.Count(f => f.Status == FeedbackStatus.Done);

            double? growth = previousTotal > 0 ? Math.Round((double)(currentTotal - previousTotal) / previousTotal * 100, 1) : null;
            double? resolvedGrowth = previousResolved > 0 ? Math.Round((double)(currentResolved - previousResolved) / previousResolved * 100, 1) : null;

            return new VolumeEvolution(
                received, resolved,
                currentTotal, previousTotal, growth,
                Math.Round((double)currentTotal / days, 1),
                currentResolved, previousResolved, resolvedGrowth);
        }

        private static (List<CategoryEvolution> All, List<CategoryEvolution> Emerging) BuildCategoryEvolution(IReadOnlyList<DashboardFeedbackDataCurrent> current, IReadOnlyList<DashboardFeedbackDataPrevious> previous)
        {
            var total = current.Count;
            var prevTotal = previous.Count;

            var currentByCat = current.GroupBy(f => f.Category.ToString()).ToDictionary(g => g.Key, g => g.Count());
            var previousByCat = previous.GroupBy(f => f.Category.ToString()).ToDictionary(g => g.Key, g => g.Count());

            var allCategories = currentByCat.Keys.Union(previousByCat.Keys).Distinct();

            var categories = allCategories
                .Select(cat =>
                {
                    var curr = currentByCat.TryGetValue(cat, out var c) ? c : 0;
                    var prev = previousByCat.TryGetValue(cat, out var p) ? p : 0;
                    var pct = total > 0 ? Math.Round((double)curr / total * 100, 1) : 0;
                    var delta = prev > 0
                        ? (double?)Math.Round((double)(curr - prev) / prev * 100, 1)
                        : null;
                    return new CategoryEvolution(cat, curr, prev, pct, delta, prev == 0 && curr >= 3);
                })
                .OrderByDescending(c => c.CurrentCount)
                .ToList();

            var emerging = categories.Where(c => c.IsEmerging).ToList();

            return (categories, emerging);
        }

        private static List<ProjectEvolution> BuildProjectEvolution(IReadOnlyList<DashboardFeedbackDataCurrent> current, IReadOnlyList<DashboardFeedbackDataPrevious> previous)
        {
            var currentByProject = current.GroupBy(f => new { f.ProjectId, f.ProjectName }).ToDictionary(g => g.Key, g => g.Count());
            var previousByProject = previous.GroupBy(f => new { f.ProjectId, f.ProjectName }).ToDictionary(g => g.Key, g => g.Count());

            return currentByProject
                .Select(kv =>
                {
                    var prev = previousByProject.TryGetValue(kv.Key, out var p) ? p : 0;
                    var growth = prev > 0
                        ? (double?)Math.Round((double)(kv.Value - prev) / prev * 100, 1)
                        : null;
                    return new ProjectEvolution(kv.Key.ProjectId, kv.Key.ProjectName, kv.Value, prev, growth);
                })
                .OrderByDescending(p => p.CurrentCount)
                .Take(10)
                .ToList();
        }

        private static BacklogHealth BuildBacklogHealth(IReadOnlyList<DashboardFeedbackDataCurrent> current, DateTime now)
        {
            var open = current.Where(f => f.Status != FeedbackStatus.Done).ToList();
            var resolved = current.Count(f => f.Status == FeedbackStatus.Done);
            var total = current.Count;

            var ratio = total > 0 ? Math.Round((double)resolved / Math.Max(total - resolved, 1), 2) : 0;

            var ages = open.Select(f => (now - (DateTime)f.CreatedAt).TotalDays).ToList();
            var avgAge = ages.Any() ? Math.Round(ages.Average(), 1) : 0;
            var oldestAge = ages.Any() ? (int)Math.Round(ages.Max()) : 0;

            return new BacklogHealth(open.Count, resolved, ratio, avgAge, oldestAge);
        }

        private static ResolutionMetrics BuildResolutionMetrics(IReadOnlyList<DashboardFeedbackDataCurrent> current, IReadOnlyList<DashboardFeedbackDataPrevious> previous, DateTime from, DateTime now)
        {
            static double? ComputeAvg(IEnumerable<dynamic> feedbacks)
            {
                var times = feedbacks
                    .Where(f => f.ResolvedAt != null)
                    .Select(f => ((DateTime)f.ResolvedAt - (DateTime)f.CreatedAt).TotalDays)
                    .ToList();
                return times.Any() ? Math.Round(times.Average(), 1) : null;
            }

            var currentAvg = ComputeAvg(current);
            var previousAvg = ComputeAvg(previous);
            double? delta = currentAvg.HasValue && previousAvg.HasValue
                ? Math.Round(currentAvg.Value - previousAvg.Value, 1)
                : null;

            // Courbe du temps moyen de résolution par semaine
            var weeklyAvgs = current
                .Where(f => f.ResolvedAt != null)
                .GroupBy(f => ((DateTime)f.CreatedAt).Date.AddDays(-(int)((DateTime)f.CreatedAt).DayOfWeek))
                .OrderBy(g => g.Key)
                .Select(g =>
                {
                    var avg = g.Average(f => ((DateTime)f.ResolvedAt - (DateTime)f.CreatedAt).TotalDays);
                    return new SeriesPoint(g.Key.ToString("yyyy-MM-dd"), (int)Math.Round(avg));
                })
                .ToList();

            return new ResolutionMetrics(currentAvg, previousAvg, delta, weeklyAvgs);
        }

        private static List<PriorityPoint> BuildPriorityTrend(IReadOnlyList<DashboardFeedbackDataCurrent> current, DateTime from, DateTime now)
        {
            var byDate = current.GroupBy(f => ((DateTime)f.CreatedAt).Date);

            return Enumerable.Range(0, (int)(now.Date - from.Date).TotalDays + 1)
                .Select(i => from.Date.AddDays(i))
                .Select(date =>
                {
                    var dayItems = current.Where(f => ((DateTime)f.CreatedAt).Date == date).ToList();
                    return new PriorityPoint(
                        date.ToString("yyyy-MM-dd"),
                        dayItems.Count(f => f.Priority == FeedbackPriority.Critical),
                        dayItems.Count(f => f.Priority == FeedbackPriority.High),
                        dayItems.Count(f => f.Priority == FeedbackPriority.Normal),
                        dayItems.Count(f => f.Priority == FeedbackPriority.Low));
                })
                .ToList();
        }

        private static List<AutoAlert> BuildAlerts(IList<CategoryEvolution> categories, BacklogHealth backlog, ResolutionMetrics resolution, VolumeEvolution volume)
        {
            var alerts = new List<AutoAlert>();

            // Catégorie en forte hausse
            foreach (var cat in categories.Where(c => c.Delta >= 30))
                alerts.Add(new AutoAlert("warning",
                    $"Les {cat.Category.ToLower()} ont augmenté de {cat.Delta}% vs la période précédente."));

            // Backlog qui grossit
            if (backlog.ResolutionRatio < 0.8)
                alerts.Add(new AutoAlert("danger",
                    $"Le backlog grossit — ratio résolution/création : {backlog.ResolutionRatio:F1}. " +
                    $"{backlog.OpenCount} feedbacks ouverts."));

            // Temps de résolution dégradé
            if (resolution.Delta > 1.0)
                alerts.Add(new AutoAlert("warning",
                    $"Le délai moyen de résolution a augmenté de {resolution.Delta:F1} jours " +
                    $"({resolution.PreviousAverageResolutionDays:F1}j → {resolution.AverageResolutionDays:F1}j)."));

            // Feedbacks très anciens
            if (backlog.OldestOpenDays > 30)
                alerts.Add(new AutoAlert("danger",
                    $"Le feedback ouvert le plus ancien a {backlog.OldestOpenDays} jours sans résolution."));

            // Volume en forte hausse
            if (volume.GrowthPercent >= 40)
                alerts.Add(new AutoAlert("info",
                    $"Le volume de feedbacks a augmenté de {volume.GrowthPercent}% vs la période précédente."));

            return alerts;
        }
    }
}
