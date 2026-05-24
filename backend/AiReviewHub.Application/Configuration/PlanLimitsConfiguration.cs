using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Configuration
{
    /// <summary>
    /// Source de vérité unique pour toutes les limites par plan.
    /// Toute modification de limite se fait exclusivement ici.
    /// </summary>
    public static class PlanLimitsConfiguration
    {
        private static readonly Dictionary<Plan, PlanLimits> Limits = new()
        {
            [Plan.Free] = new PlanLimits(
                MaxFeedbacksPerMonth: 50,
                MaxProjects: 1,
                MaxTeamMembers: 1,
                MaxDailyAiAnalyses: 50),

            [Plan.Pro] = new PlanLimits(
                MaxFeedbacksPerMonth: 2000,
                MaxProjects: 10,
                MaxTeamMembers: 5,
                MaxDailyAiAnalyses: 500),

            [Plan.Team] = new PlanLimits(
                MaxFeedbacksPerMonth: 10000,
                MaxProjects: -1,
                MaxTeamMembers: -1,
                MaxDailyAiAnalyses: 2000),
        };

        public static PlanLimits For(Plan plan)
        {
            if (!Limits.TryGetValue(plan, out var limits))
                throw new ArgumentOutOfRangeException(nameof(plan), $"No limits configured for plan {plan}");

            return limits;
        }
    }
}
