using AiReviewHub.Application.Abstractions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Users.Queries.GetQuota
{
    public record GetQuotaQuery : IRequest<GetQuotaResult>;

    public record GetQuotaResult(
        string Plan,
        int FeedbacksThisMonth,
        int FeedbacksLimit, // -1 = illimité
        int ProjectCount,
        int ProjectsLimit, // -1 = illimité
        double UsagePercent // 0-100, pour la barre de progression
    );

    public class GetQuotaHandler : IRequestHandler<GetQuotaQuery, GetQuotaResult>
    {
        private readonly IAppDbContext _context;
        private readonly ICurrentUserService _currentUser;
        private readonly IPlanLimitsService _planLimits;

        public GetQuotaHandler(
            IAppDbContext context,
            ICurrentUserService currentUser,
            IPlanLimitsService planLimits)
        {
            _context = context;
            _currentUser = currentUser;
            _planLimits = planLimits;
        }

        public async Task<GetQuotaResult> Handle(GetQuotaQuery request, CancellationToken cancellationToken)
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == _currentUser.UserId, cancellationToken)
                ?? throw new UnauthorizedAccessException("User not found");

            var limits = _planLimits.GetLimits(user.Plan);

            var feedbacksThisMonth = await _planLimits.GetCurrentFeedbackCountAsync(_currentUser.UserId, cancellationToken);

            var projectCount = await _context.Projects
                .AsNoTracking()
                .CountAsync(p => p.UserId == _currentUser.UserId && p.IsActive, cancellationToken);

            var usagePercent = limits.MaxFeedbacksPerMonth == -1
                ? 0
                : Math.Round((double)feedbacksThisMonth / limits.MaxFeedbacksPerMonth * 100, 1);

            return new GetQuotaResult(
                Plan: user.Plan.ToString(),
                FeedbacksThisMonth: feedbacksThisMonth,
                FeedbacksLimit: limits.MaxFeedbacksPerMonth,
                ProjectCount: projectCount,
                ProjectsLimit: limits.MaxProjects,
                UsagePercent: usagePercent
            );
        }
    }
}
                
