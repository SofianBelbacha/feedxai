using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Enums;
using AiReviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Infrastructure.Services
{

    public class PlanLimitsService : IPlanLimitsService
    {
        // ── Limites par plan ───────────────────────────────────
        // Alignées avec le pricing décidé : Free=50, Pro=2000, Team=10000
        private static readonly Dictionary<Plan, PlanLimits> Limits = new()
        {
            [Plan.Free] = new PlanLimits(
                MaxProjects: 1,
                MaxFeedbacksPerMonth: 50),

            [Plan.Pro] = new PlanLimits(
                MaxProjects: 10,
                MaxFeedbacksPerMonth: 2_000),

            [Plan.Team] = new PlanLimits(
                MaxProjects: -1,       // illimité
                MaxFeedbacksPerMonth: 10_000),
        };

        private readonly AppDbContext _context;
        private readonly ILogger<PlanLimitsService> _logger;

        public PlanLimitsService(AppDbContext context, ILogger<PlanLimitsService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public PlanLimits GetLimits(Plan plan) => Limits[plan];

        public async Task<int> GetMonthlyFeedbackCountAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            var now = DateTime.UtcNow;
            var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

            return await _context.Feedbacks
                .AsNoTracking()
                .Where(f =>
                    f.Project.UserId == userId &&
                    f.CreatedAt >= monthStart)
                .CountAsync(cancellationToken);
        }

        public async Task<bool> CanSubmitFeedbackAsync(
            Guid userId,
            Plan plan,
            CancellationToken cancellationToken = default)
        {
            var limits = GetLimits(plan);

            // -1 = illimité → toujours autorisé
            if (limits.MaxFeedbacksPerMonth == -1)
                return true;

            var count = await GetMonthlyFeedbackCountAsync(userId, cancellationToken);
            var canSubmit = count < limits.MaxFeedbacksPerMonth;

            if (!canSubmit)
                _logger.LogWarning(
                    "[PlanLimits] User {UserId} ({Plan}) reached monthly feedback limit: {Count}/{Max}",
                    userId, plan, count, limits.MaxFeedbacksPerMonth);

            return canSubmit;
        }
    }
}
