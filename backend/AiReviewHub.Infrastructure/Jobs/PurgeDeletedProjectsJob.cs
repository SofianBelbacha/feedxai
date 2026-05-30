using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Infrastructure.Jobs
{
    public class PurgeDeletedProjectsJob
    {
        private readonly AppDbContext _context;
        private readonly IDateTimeProvider _dateTime;
        private readonly ILogger<PurgeDeletedProjectsJob> _logger;

        public PurgeDeletedProjectsJob(
            AppDbContext context,
            IDateTimeProvider dateTime,
            ILogger<PurgeDeletedProjectsJob> logger)
        {
            _context = context;
            _dateTime = dateTime;
            _logger = logger;
        }

        public async Task ExecuteAsync()
        {
            var cutoff = _dateTime.UtcNow.AddDays(-30);

            // IgnoreQueryFilters() pour accéder aux projets soft-deleted
            var toDelete = await _context.Projects
                .IgnoreQueryFilters()
                .Where(p => p.DeletedAt != null && p.DeletedAt < cutoff)
                .ToListAsync();

            if (!toDelete.Any())
            {
                _logger.LogInformation("[Purge] No projects to purge");
                return;
            }

            // La suppression physique cascade sur les feedbacks
            // via la configuration FK avec DeleteBehavior.Cascade
            _context.Projects.RemoveRange(toDelete);
            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "[Purge] Purged {Count} project(s) deleted before {Cutoff}",
                toDelete.Count, cutoff);
        }
    }
}
