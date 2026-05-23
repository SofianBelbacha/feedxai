using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Enums;
using AiReviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Infrastructure.Services
{

    public class AiQuotaService : IAiQuotaService
    {
        private readonly AppDbContext _context;
        private readonly IDateTimeProvider _dateTime;

        // Une seule source de vérité pour les limites journalières
        private static readonly Dictionary<Plan, int> DailyLimits = new()
    {
        { Plan.Free, 50 },
        { Plan.Pro, 500 },
        { Plan.Team, 2000 },
    };

        public AiQuotaService(AppDbContext context, IDateTimeProvider dateTime)
        {
            _context = context;
            _dateTime = dateTime;
        }

        public async Task<bool> TryConsumeAsync(Guid userId, Plan plan, CancellationToken ct = default)
        {
            var limit = DailyLimits[plan];
            var today = DateOnly.FromDateTime(_dateTime.UtcNow);

            // Upsert + incrément atomique en une seule requête SQL
            // Retourne le nouveau compteur, ou null si la limite est déjà atteinte
            var newCount = await _context.Database.ExecuteSqlAsync($"""
                INSERT INTO ai_usage_counters (user_id, date, count)
                VALUES ({userId}, {today}, 1)
                ON CONFLICT (user_id, date)
                DO UPDATE SET count = ai_usage_counters.count + 1
                WHERE ai_usage_counters.count < {limit}
                RETURNING count
                """, ct);

            // ExecuteSqlAsync retourne le nombre de lignes affectées
            // 1 ligne = INSERT ou UPDATE réussi → autorisé
            // 0 ligne = WHERE count < limit a bloqué → quota atteint
            return newCount > 0;
        }

        public async Task<int> GetCurrentUsageAsync(Guid userId, CancellationToken ct = default)
        {
            var today = DateOnly.FromDateTime(_dateTime.UtcNow);

            return await _context.AiUsageCounters
                .AsNoTracking()
                .Where(x => x.UserId == userId && x.Date == today)
                .Select(x => x.Count)
                .FirstOrDefaultAsync(ct); // retourne 0 si pas encore de ligne
        }
    }
}
