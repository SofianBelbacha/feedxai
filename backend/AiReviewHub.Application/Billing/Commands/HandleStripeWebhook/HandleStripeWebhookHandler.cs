using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Enums;
using AiReviewHub.Domain.ValueObjects;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Stripe;
using System;
using System.Collections.Generic;
using System.Text;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace AiReviewHub.Application.Billing.Commands.HandleStripeWebhook
{
    public class HandleStripeWebhookHandler
        : IRequestHandler<HandleStripeWebhookCommand, Unit>
    {
        private readonly IAppDbContext _context;
        private readonly IDateTimeProvider _dateTimeProvider;
        private readonly IConfiguration _configuration;
        private readonly ILogger<HandleStripeWebhookHandler> _logger;

        public HandleStripeWebhookHandler(
            IAppDbContext context,
            IDateTimeProvider dateTimeProvider,
            IConfiguration configuration,
            ILogger<HandleStripeWebhookHandler> logger)
        {
            _context = context;
            _dateTimeProvider = dateTimeProvider;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<Unit> Handle(HandleStripeWebhookCommand request, CancellationToken cancellationToken)
        {
            var webhookSecret = _configuration["Stripe:WebhookSecret"]
                ?? throw new InvalidOperationException("Stripe:WebhookSecret not configured");

            Event stripeEvent;
            try
            {
                stripeEvent = EventUtility.ConstructEvent(
                    request.Payload,
                    request.StripeSignature,
                    webhookSecret);
            }
            catch (StripeException ex)
            {
                _logger.LogWarning("Stripe webhook signature verification failed: {Message}", ex.Message);
                throw new UnauthorizedAccessException("Invalid Stripe webhook signature.");
            }

            _logger.LogInformation("[Stripe Webhook] Received event: {EventType}", stripeEvent.Type);

            switch (stripeEvent.Type)
            {
                case "checkout.session.completed":
                    await HandleCheckoutSessionCompletedAsync(stripeEvent, cancellationToken);
                    break;

                case "customer.subscription.updated":
                case "customer.subscription.deleted":
                    await HandleSubscriptionChangedAsync(stripeEvent, cancellationToken);
                    break;

                default:
                    _logger.LogInformation("[Stripe Webhook] Unhandled event type: {EventType}", stripeEvent.Type);
                    break;
            }

            return Unit.Value;
        }

        // ── checkout.session.completed ────────────────────────
        private async Task HandleCheckoutSessionCompletedAsync(Event stripeEvent, CancellationToken cancellationToken)
        {
            var session = stripeEvent.Data.Object as Stripe.Checkout.Session;
            if (session is null) return;

            var customerEmail = session.CustomerEmail
                ?? session.CustomerDetails?.Email;

            if (string.IsNullOrWhiteSpace(customerEmail))
            {
                _logger.LogWarning("[Stripe] checkout.session.completed — no email found");
                return;
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email == Email.Create(customerEmail), cancellationToken);

            if (user is null)
            {
                _logger.LogWarning("[Stripe] checkout.session.completed — user not found for email {Email}", customerEmail);
                return;
            }

            // Sauvegarde du Stripe Customer ID
            if (!string.IsNullOrWhiteSpace(session.CustomerId)
                && string.IsNullOrWhiteSpace(user.StripeCustomerId))
            {
                user.SetStripeCustomerId(session.CustomerId, _dateTimeProvider);
            }

            // Mise à jour du plan selon le metadata ou le price lookup
            var planStr = session.Metadata?.GetValueOrDefault("plan");
            if (!string.IsNullOrWhiteSpace(planStr) && Enum.TryParse<Domain.Enums.Plan>(planStr, true, out var plan))
            {
                if (user.Plan != plan)
                    user.UpdatePlan(plan, _dateTimeProvider);
            }

            if (!string.IsNullOrWhiteSpace(session.SubscriptionId))
            {
                var subscriptionService = new SubscriptionService();
                var subscription = await subscriptionService.GetAsync(session.SubscriptionId, cancellationToken: cancellationToken);

                if (subscription is not null)
                {
                    user.UpdateBillingPeriod(subscription.Items.Data[0].CurrentPeriodStart, subscription.Items.Data[0].CurrentPeriodEnd, _dateTimeProvider);

                    _logger.LogInformation("[Stripe] Billing period set for user {UserId}: {Start} → {End}",
                        user.Id, subscription.Items.Data[0].CurrentPeriodStart, subscription.Items.Data[0].CurrentPeriodEnd);
                }
            }

            await _context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("[Stripe] User {UserId} upgraded to plan {Plan}", user.Id, user.Plan);
        }

        // ── customer.subscription.updated / deleted ───────────
        private async Task HandleSubscriptionChangedAsync(
            Event stripeEvent, CancellationToken cancellationToken)
        {
            var subscription = stripeEvent.Data.Object as Stripe.Subscription;
            if (subscription is null) return;

            var customerId = subscription.CustomerId;

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.StripeCustomerId == customerId, cancellationToken);

            if (user is null)
            {
                _logger.LogWarning("[Stripe] subscription event — user not found for customerId {CustomerId}", customerId);
                return;
            }

            // Si l'abonnement est annulé/expiré → Free
            if (stripeEvent.Type == "customer.subscription.deleted"
                || subscription.Status is "canceled" or "unpaid" or "incomplete_expired")
            {
                if (user.Plan != Domain.Enums.Plan.Free)
                    user.UpdatePlan(Domain.Enums.Plan.Free, _dateTimeProvider);

                // Reset la période sur le mois calendaire courant pour les Free
                var now = _dateTimeProvider.UtcNow;
                user.UpdateBillingPeriod(
                    new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc),
                    new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1),
                    _dateTimeProvider);

            }
            else if (subscription.Status == "active" || subscription.Status == "trialing")
            {
                // On pourrait vérifier le priceId ici pour Pro vs Team
                var planStr = subscription.Metadata?.GetValueOrDefault("plan");
                if (!string.IsNullOrWhiteSpace(planStr) && Enum.TryParse<Domain.Enums.Plan>(planStr, true, out var plan))
                {
                    if (user.Plan != plan)
                        user.UpdatePlan(plan, _dateTimeProvider);
                }

                // Stripe envoie cet event à chaque renouvellement avec les nouvelles dates
                user.UpdateBillingPeriod(subscription.Items.Data[0].CurrentPeriodStart, subscription.Items.Data[0].CurrentPeriodEnd, _dateTimeProvider);

                _logger.LogInformation(
                    "[Stripe] Billing period renewed for user {UserId}: {Start} → {End}",
                    user.Id, subscription.Items.Data[0].CurrentPeriodStart, subscription.Items.Data[0].CurrentPeriodEnd);

            }

            await _context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("[Stripe] Subscription changed for user {UserId} → Plan: {Plan}", user.Id, user.Plan);
        }
    }
}
