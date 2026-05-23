using AiReviewHub.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Abstractions
{
    public interface IAiQuotaService
    {
        /// <summary>
        /// Tente d'incrémenter le compteur de façon atomique.
        /// Retourne true si l'analyse est autorisée, false si le quota est atteint.
        /// </summary>

        Task<bool> TryConsumeAsync(Guid userId, Plan plan, CancellationToken ct = default);
        Task<int> GetCurrentUsageAsync(Guid userId, CancellationToken ct = default);
    }
}
