using AiReviewHub.Application.Abstractions;
using AiReviewHub.Application.Configuration;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Entities;
using AiReviewHub.Domain.Enums;
using AiReviewHub.Domain.Exceptions;
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

        private readonly AppDbContext _context;
        private readonly ILogger<PlanLimitsService> _logger;
        private readonly IDateTimeProvider _dateTime;

        public PlanLimitsService(AppDbContext context, ILogger<PlanLimitsService> logger, IDateTimeProvider dateTime)
        {
            _context = context;
            _logger = logger;
            _dateTime = dateTime;

        }

        public PlanLimits GetLimits(Plan plan) => PlanLimitsConfiguration.For(plan);


        public async Task<QuotaConsumeResult> TryConsumeFeedbackSlotAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            // Récupère le plan et les limites en une seule requête
            var user = await _context.Users
                .AsNoTracking()
                .Where(x => x.Id == userId)
                .Select(x => new { x.Plan, x.QuotaResetDate, x.BillingPeriodEnd })
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundException($"User {userId} introuvable.");

            var limits = GetLimits(user.Plan);

            // Illimité — pas besoin de toucher le compteur
            if (limits.MaxFeedbacksPerMonth == -1)
                return QuotaConsumeResult.Allowed(current: 0, limit: -1);

            var now = _dateTime.UtcNow;

            // La nouvelle date de reset vient exclusivement de BillingPeriodEnd
            // Elle est mise à jour par le webhook Stripe customer.subscription.updated
            // On ne recalcule JAMAIS le mois calendaire ici
            var newResetDate = user.BillingPeriodEnd;


            // Atomic upsert : reset si nouvelle période + incrément si sous la limite
            var rowsAffected = await _context.Database.ExecuteSqlAsync($"""
                UPDATE users SET
                    feedbacks_this_month = CASE
                        WHEN quota_reset_date <= {now} THEN 1
                        ELSE feedbacks_this_month + 1
                    END,
                    quota_reset_date = CASE
                        WHEN quota_reset_date <= {now}
                        THEN {newResetDate}
                        ELSE quota_reset_date
                    END
                WHERE id = {userId}
                  AND (
                    quota_reset_date <= {now}
                    OR feedbacks_this_month < {limits.MaxFeedbacksPerMonth}
                  )
                """, cancellationToken);

            if (rowsAffected == 0)
            {
                // WHERE bloqué → quota atteint
                var current = await _context.Users
                    .AsNoTracking()
                    .Where(x => x.Id == userId)
                    .Select(x => x.FeedbacksThisMonth)
                    .FirstOrDefaultAsync(cancellationToken);

                return QuotaConsumeResult.Denied(current, limits.MaxFeedbacksPerMonth);
            }

            return QuotaConsumeResult.Allowed(
                current: limits.MaxFeedbacksPerMonth, // valeur approx, suffisant pour l'UX
                limit: limits.MaxFeedbacksPerMonth);
        }

        public async Task<int> GetCurrentFeedbackCountAsync(Guid userId, CancellationToken ct = default)
        {
            return await _context.Users
                .AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => u.FeedbacksThisMonth)
                .FirstOrDefaultAsync(ct);
        }

    }
}
