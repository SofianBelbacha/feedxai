using AiReviewHub.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Abstractions
{
    public interface IWidgetProtectionService
    {
        /// <summary>
        /// Vérifie si le projet peut encore recevoir des soumissions aujourd'hui.
        /// Limite : 3x la limite journalière IA du plan, au minimum 100.
        /// </summary>
        Task<bool> CanAcceptSubmissionAsync(Guid projectId, Plan ownerPlan, CancellationToken ct = default);
    }
}
