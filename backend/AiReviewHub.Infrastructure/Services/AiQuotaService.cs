using AiReviewHub.Domain.Enums;
using Microsoft.Extensions.Caching.Memory;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Infrastructure.Services
{
    public interface IAiQuotaService
    {
        Task<bool> CanAnalyzeAsync(Guid userId, Plan plan);
        Task IncrementAsync(Guid userId);
    }

    public class AiQuotaService : IAiQuotaService
    {
        private readonly IMemoryCache _cache;

        // Quotas journaliers par plan
        private static readonly Dictionary<Plan, int> DailyQuotas = new()
    {
        { Plan.Free, 50   },
        { Plan.Pro,  500  },
        { Plan.Team, 2000 }
    };

        public AiQuotaService(IMemoryCache cache)
        {
            _cache = cache;
        }

        public Task<bool> CanAnalyzeAsync(Guid userId, Plan plan)
        {
            var key = $"ai_quota:{userId}:{DateTime.UtcNow:yyyy-MM-dd}";
            var count = _cache.GetOrCreate(key, e =>
            {
                e.AbsoluteExpiration = DateTime.UtcNow.Date.AddDays(1);
                return 0;
            });

            return Task.FromResult(count < DailyQuotas[plan]);
        }

        public Task IncrementAsync(Guid userId)
        {
            var key = $"ai_quota:{userId}:{DateTime.UtcNow:yyyy-MM-dd}";
            var count = _cache.GetOrCreate(key, e =>
            {
                e.AbsoluteExpiration = DateTime.UtcNow.Date.AddDays(1);
                return 0;
            });

            _cache.Set(key, count + 1,
                DateTime.UtcNow.Date.AddDays(1));

            return Task.CompletedTask;
        }
    }
}
