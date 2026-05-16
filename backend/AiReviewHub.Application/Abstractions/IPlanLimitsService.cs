using AiReviewHub.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Abstractions
{
    public record PlanLimits(
        int MaxProjects,       // -1 = illimité
        int MaxFeedbacksPerMonth  // -1 = illimité
    );

    public interface IPlanLimitsService
    {
        PlanLimits GetLimits(Plan plan);

        Task<int> GetMonthlyFeedbackCountAsync(
            Guid userId,
            CancellationToken cancellationToken = default);

        Task<bool> CanSubmitFeedbackAsync(
            Guid userId,
            Plan plan,
            CancellationToken cancellationToken = default);
    }
}
