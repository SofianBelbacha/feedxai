using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Enums;
using AiReviewHub.Domain.ValueObjects;
using System;
using System.Collections.Generic;
using System.Numerics;
using System.Text;

namespace AiReviewHub.Domain.Entities
{
    public class User
    {
        public Guid Id { get; private set; }
        public Email Email { get; private set; } = null!;
        public PasswordHash? PasswordHash { get; private set; }
        public string FirstName { get; private set; } = string.Empty;
        public string LastName { get; private set; } = string.Empty;
        public string? GoogleId { get; private set; }
        public bool IsOAuthUser => PasswordHash is null;
        public Plan Plan { get; private set; }
        public DateTime CreatedAt { get; private set; }
        public DateTime? UpdatedAt { get; private set; }
        public string? StripeCustomerId { get; private set; }
        public DateTime BillingPeriodStart { get; private set; }
        public DateTime BillingPeriodEnd { get; private set; }
        public int FeedbacksThisMonth { get; private set; }
        public DateTime QuotaResetDate { get; private set; }

        public ICollection<Project> Projects { get; private set; } = [];

        private readonly List<RefreshToken> _refreshTokens = [];

        public IReadOnlyCollection<RefreshToken> RefreshTokens => _refreshTokens.AsReadOnly();

        private User() { }

        public static User Create(string email, string passwordHash, string firstName, string lastName, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(firstName))
                throw new ArgumentException("First name cannot be empty");

            if (string.IsNullOrWhiteSpace(lastName))
                throw new ArgumentException("Last name cannot be empty");

            return new User
            {
                Id = Guid.NewGuid(),
                Email = Email.Create(email),
                PasswordHash = PasswordHash.Create(passwordHash),
                FirstName = firstName.Trim(),
                LastName = lastName.Trim(),
                Plan = Plan.Free,
                CreatedAt = now
            };
        }

        // Factory OAuth Google
        public static User CreateWithGoogle(string email, string firstName, string lastName, string googleId, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(firstName))
                throw new ArgumentException("First name cannot be empty");

            lastName = lastName?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(googleId))
                throw new ArgumentException("Google ID cannot be empty");

            return new User
            {
                Id = Guid.NewGuid(),
                Email = Email.Create(email),
                PasswordHash = null, // pas de mot de passe pour OAuth
                FirstName = firstName.Trim(),
                LastName = lastName.Trim() ?? string.Empty,
                GoogleId = googleId,
                Plan = Plan.Free,
                CreatedAt = now
            };
        }

        // Lie un compte Google à un compte existant
        public void LinkGoogleAccount(string googleId, DateTime now)
        {
            if (!string.IsNullOrWhiteSpace(GoogleId))
                return; // déjà lié — pas d'erreur, idempotent

            GoogleId = googleId;
            UpdatedAt = now;
        }

        public void RevokeOldestActiveSession(DateTime now)
        {
            var oldest = _refreshTokens
                .Where(t => t.IsActive)
                .OrderBy(t => t.CreatedAt)
                .FirstOrDefault();

            oldest?.Revoke(now);
        }

        public void CleanupRefreshTokens(DateTime now)
        {
            var cutoff = now.AddDays(-30);

            var toRemove = _refreshTokens
                .Where(t => !t.IsActive && t.RevokedAt != null && t.RevokedAt < cutoff)
                .ToList();

            foreach (var token in toRemove)
                _refreshTokens.Remove(token);
        }

        public void UpdatePlan(Plan plan, IDateTimeProvider dateTimeProvider)
        {
            if (Plan == plan)
                throw new InvalidOperationException($"User is already on {plan} plan");

            Plan = plan;
            UpdatedAt = dateTimeProvider.UtcNow;
        }

        public void SetStripeCustomerId(string customerId, IDateTimeProvider dateTimeProvider)
        {
            StripeCustomerId = customerId;
            UpdatedAt = dateTimeProvider.UtcNow;
        }

        public void UpdateBillingPeriod(DateTime periodStart, DateTime periodEnd, IDateTimeProvider dateTimeProvider)
        {
            BillingPeriodStart = periodStart;
            BillingPeriodEnd = periodEnd;
            // Synchroniser le QuotaResetDate avec la période Stripe
            QuotaResetDate = periodEnd;
            UpdatedAt = dateTimeProvider.UtcNow;
        }


    }

}
