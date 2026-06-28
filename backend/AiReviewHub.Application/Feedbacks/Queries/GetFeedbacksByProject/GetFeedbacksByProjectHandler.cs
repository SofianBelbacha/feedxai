using AiReviewHub.Application.Abstractions;
using AiReviewHub.Application.Common.Models;
using AiReviewHub.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;

namespace AiReviewHub.Application.Feedbacks.Queries.GetFeedbacksByProject
{
    public class GetFeedbacksByProjectHandler : IRequestHandler<GetFeedbacksByProjectQuery, PagedResult<FeedbackDto>>
    {
        private readonly IAppDbContext _context;
        private readonly ICurrentUserService _currentUser;


        public GetFeedbacksByProjectHandler(IAppDbContext context, ICurrentUserService currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<PagedResult<FeedbackDto>> Handle(GetFeedbacksByProjectQuery request, CancellationToken cancellationToken)
        {
            var pageSize = Math.Clamp(request.PageSize, 1, 100);
            var page = Math.Max(request.Page, 1);


            // Vérifie que le projet existe ET récupère le plan du propriétaire
            // (on a besoin du plan pour valider les filtres Pro)
            var project = await _context.Projects
                .Include(p => p.User)
                .AsNoTracking()
                .FirstOrDefaultAsync(p =>
                    p.Id == request.ProjectId &&
                    p.UserId == _currentUser.UserId,
                    cancellationToken)
                ?? throw new NotFoundException($"Project {request.ProjectId} not found");

            // ── Garde-fou paywall : les filtres IA avancés sont réservés à Pro/Team ──
            var hasAdvancedFilter = request.ActionRequired == true
                || !string.IsNullOrWhiteSpace(request.Sentiment)
                || request.MinScore.HasValue;

            if (hasAdvancedFilter && project.User.Plan == Domain.Enums.Plan.Free)
                throw new ForbiddenException(
                    "Advanced AI filters are available on Pro and Team plans.");


            // Construction de la query avec filtres optionnels
            var query = _context.Feedbacks
                .AsNoTracking()
                .Where(f => f.ProjectId == request.ProjectId);

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var search = request.Search.ToLowerInvariant();
                query = query.Where(f =>
                    f.Content.Value.ToLower().Contains(search) ||
                    f.AiSummary.ToLower().Contains(search));
            }

            if (request.StatusFilter.HasValue)
                query = query.Where(f => f.Status == request.StatusFilter.Value);

            if (request.CategoryFilter.HasValue)
                query = query.Where(f => f.Category == request.CategoryFilter.Value);

            if (request.PriorityFilter.HasValue)
                query = query.Where(f => f.Priority == request.PriorityFilter.Value);

            // Filtres IA avancés
            if (request.ActionRequired == true)
                query = query.Where(f => f.ActionRequired == true);

            if (!string.IsNullOrWhiteSpace(request.Sentiment))
                query = query.Where(f => f.Sentiment == request.Sentiment);

            if (request.MinScore.HasValue)
                query = query.Where(f => f.PriorityScore >= request.MinScore.Value);

            var total = await query.CountAsync(cancellationToken);

            // Tri — en SQL, pas en mémoire
            var ordered = request.SortBy switch
            {
                "oldest" => query.OrderBy(f => f.CreatedAt),
                "priority" => query.OrderBy(f => f.Priority),   
                "score" => query.OrderByDescending(f => f.PriorityScore ?? 0),
                "action" => query.OrderByDescending(f => f.ActionRequired == true ? 1 : 0).ThenByDescending(f => f.PriorityScore ?? 0),
                _ => query.OrderByDescending(f => f.CreatedAt)
            };

            var feedbacks = await ordered
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);
            
            var dtos = feedbacks
                .Select(f => new FeedbackDto(
                    f.Id,
                    f.Content.Value,
                    f.AiSummary,
                    f.Category.ToString(),
                    f.Priority.ToString(),
                    f.Status.ToString(),
                    f.AiAnalysisStatus.ToString(),
                    f.PriorityScore,
                    f.Sentiment,
                    f.SentimentScore,
                    f.KeyTopics is not null
                        ? JsonSerializer.Deserialize<string[]>(f.KeyTopics) ?? []
                        : [],
                    f.ActionRequired,
                    f.Urgency,
                    f.CreatedAt,
                    f.UpdatedAt
                ))
                .ToList();

            return new PagedResult<FeedbackDto>(dtos, PaginationMeta.Create(total, page, pageSize));
        }
    }
}
