using AiReviewHub.Application.Abstractions;
using AiReviewHub.Application.Configuration;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Enums;
using AiReviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Infrastructure.Services
{
    public class WidgetProtectionService : IWidgetProtectionService
    {
        private readonly AppDbContext _context;
        private readonly IDateTimeProvider _dateTime;

        public WidgetProtectionService(AppDbContext context, IDateTimeProvider dateTime)
        {
            _context = context;
            _dateTime = dateTime;
        }

        public async Task<bool> CanAcceptSubmissionAsync(
            Guid projectId, Plan ownerPlan, CancellationToken ct = default)
        {
            var limits = PlanLimitsConfiguration.For(ownerPlan);

            // Seuil : 3x la limite IA journalière, minimum 100
            // Logique : inutile d'accepter plus de feedbacks qu'on ne peut en analyser dans la journée
            var dailyThreshold = Math.Max(limits.MaxDailyAiAnalyses * 3, 100);

            var today = DateOnly.FromDateTime(_dateTime.UtcNow);
            var todayStart = today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var todayEnd = todayStart.AddDays(1);

            var countToday = await _context.Feedbacks
                .AsNoTracking()
                .CountAsync(f =>
                    f.ProjectId == projectId &&
                    f.CreatedAt >= todayStart &&
                    f.CreatedAt < todayEnd,
                    ct);

            return countToday < dailyThreshold;
        }
    }
}
