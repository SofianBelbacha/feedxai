using AiReviewHub.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Abstractions
{
    public record PlanLimits(int MaxProjects, int MaxFeedbacksPerMonth, int MaxTeamMembers, int MaxDailyAiAnalyses);

    public record QuotaConsumeResult(bool IsAllowed, int Current, int Limit)
    {
        public static QuotaConsumeResult Allowed(int current, int limit) =>
            new(true, current, limit);

        public static QuotaConsumeResult Denied(int current, int limit) =>
            new(false, current, limit);
    }

    public interface IPlanLimitsService
    {
        /// <summary>
        /// Tente de consommer un slot de feedback de façon atomique.
        /// Retourne Allowed si sous la limite, Denied si quota atteint.
        /// </summary>
        Task<QuotaConsumeResult> TryConsumeFeedbackSlotAsync(
            Guid userId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Retourne les limites du plan sans modifier le compteur.
        /// Utilisé par GetQuotaHandler pour afficher l'état dans le dashboard.
        /// </summary>
        PlanLimits GetLimits(Plan plan);

        Task<int> GetCurrentFeedbackCountAsync(Guid userId, CancellationToken ct = default);

    }
}
