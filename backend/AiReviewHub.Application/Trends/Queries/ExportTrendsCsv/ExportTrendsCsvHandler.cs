using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Entities;
using AiReviewHub.Domain.Enums;
using AiReviewHub.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Stripe.Forwarding;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Trends.Queries.ExportTrendsCsv
{
    public class ExportTrendsCsvHandler : IRequestHandler<ExportTrendsCsvQuery, ExportTrendsCsvResult>
    {
        private readonly IAppDbContext _context;
        private readonly ICurrentUserService _currentUser;
        private readonly IDateTimeProvider _dateTime;

        public ExportTrendsCsvHandler(
            IAppDbContext context,
            ICurrentUserService currentUser,
            IDateTimeProvider dateTime)
        {
            _context = context;
            _currentUser = currentUser;
            _dateTime = dateTime;
        }

        internal sealed record ExportTrendsCsvRow(
             Guid Id,
             string Content,
             string? AiSummary,
             FeedbackCategory Category,
             FeedbackPriority Priority,
             FeedbackStatus Status,
             AiAnalysisStatus AiAnalysisStatus,
             DateTime CreatedAt,
             DateTime? ResolvedAt,
             string ProjectName,
             double? DaysToResolve
        );


        public async Task<ExportTrendsCsvResult> Handle(ExportTrendsCsvQuery request, CancellationToken cancellationToken)
        {
            // ── Vérification plan — même règle que FeedbacksCsv ──
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == _currentUser.UserId, cancellationToken)
                ?? throw new NotFoundException($"User not found");

            if (user.Plan == Plan.Free)
                throw new ForbiddenException("CSV export is available on Pro and Team plans.");

            // ── Chargement des feedbacks sur la période ───────────
            var now = _dateTime.UtcNow;
            var from = now.AddDays(-request.Days);

            var query = _context.Feedbacks
                .AsNoTracking()
                .Where(f =>
                    f.Project.UserId == _currentUser.UserId &&
                    f.CreatedAt >= from);

            if (request.ProjectId.HasValue)
                query = query.Where(f => f.ProjectId == request.ProjectId.Value);

            if (request.Category.HasValue)
                query = query.Where(f => f.Category == request.Category.Value);

            if (request.Priority.HasValue)
                query = query.Where(f => f.Priority == request.Priority.Value);

            var feedbacks = await query
                .OrderByDescending(f => f.CreatedAt)
                .Select(f => new ExportTrendsCsvRow(
                    f.Id,
                    f.Content.Value,
                    f.AiSummary,
                    f.Category,
                    f.Priority,
                    f.Status,
                    f.AiAnalysisStatus,
                    f.CreatedAt,
                    f.ResolvedAt,
                    f.Project.Name,
                    f.ResolvedAt.HasValue
                    ? (double?)(f.ResolvedAt.Value - f.CreatedAt).TotalDays
                    : null
                ))
                .ToListAsync(cancellationToken);

            foreach (var f in feedbacks)
            {
                if (f.Content == null)
                    throw new Exception("Content null for Id " + f.Id);

                if (f.ProjectName == null)
                    throw new Exception("ProjectName null for Id " + f.Id);
            }

            var csv = BuildCsv(feedbacks, request.Days);
            var fileName = $"trends_{now:yyyy-MM-dd}_{request.Days}j.csv";

            return new ExportTrendsCsvResult(Encoding.UTF8.GetBytes(csv), fileName);
        }

        private static string BuildCsv(IReadOnlyList<ExportTrendsCsvRow> feedbacks, int days)
        {
            var sb = new StringBuilder();

            // BOM UTF-8 pour Excel
            sb.Append('\uFEFF');

            // Métadonnées en en-tête
            sb.AppendLine($"\"Export Trends — {days} derniers jours\"");
            sb.AppendLine();

            // En-têtes colonnes
            sb.AppendLine(
                "ID;" +
                "Projet;" +
                "Contenu;" +
                "Résumé IA;" +
                "Catégorie;" +
                "Priorité;" +
                "Statut;" +
                "Statut Analyse IA;" +
                "Date de création;" +
                "Date de résolution;" +
                "Délai résolution (j)");

            foreach (var f in feedbacks)
            {
                sb.AppendLine(string.Join(";", new[]
                {
                EscapeCsv(f.Id.ToString()),
                EscapeCsv(f.ProjectName),
                EscapeCsv(f.Content),
                EscapeCsv(f.AiSummary ?? ""),
                EscapeCsv(f.Category.ToString()),
                EscapeCsv(f.Priority.ToString()),
                EscapeCsv(f.Status.ToString()),
                EscapeCsv(f.AiAnalysisStatus.ToString()),
                EscapeCsv(((DateTime)f.CreatedAt).ToString("yyyy-MM-dd HH:mm:ss")),
                EscapeCsv(f.ResolvedAt.HasValue
                    ? ((DateTime)f.ResolvedAt).ToString("yyyy-MM-dd HH:mm:ss")
                    : ""),
                EscapeCsv(f.DaysToResolve.HasValue
                    ? Math.Round((double)f.DaysToResolve, 1).ToString()
                    : ""),
            }));
            }

            return sb.ToString();
        }

        private static string EscapeCsv(string? value)
        {
            if (string.IsNullOrEmpty(value)) return "\"\"";
            if (value.Contains('"') || value.Contains(';') || value.Contains('\n') || value.Contains('\r'))
                return $"\"{value.Replace("\"", "\"\"")}\"";
            return $"\"{value}\"";
        }
    }
}
