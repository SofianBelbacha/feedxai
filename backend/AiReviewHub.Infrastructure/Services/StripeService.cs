using AiReviewHub.Application.Abstractions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Stripe;
using Stripe.Checkout;
using System;
using System.Collections.Generic;
using System.Text;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace AiReviewHub.Infrastructure.Services
{
    public class StripeService : IStripeService
    {
        private readonly ILogger<StripeService> _logger;

        public StripeService(IConfiguration configuration, ILogger<StripeService> logger)
        {
            _logger = logger;
            StripeConfiguration.ApiKey = configuration["Stripe:SecretKey"]
                ?? throw new InvalidOperationException("Stripe:SecretKey not configured");
        }

        public async Task<CheckoutSessionResult> CreateCheckoutSessionAsync(
            string userEmail,
            string? stripeCustomerId,
            string priceId,
            string successUrl,
            string cancelUrl,
            CancellationToken cancellationToken = default)
        {
            var options = new SessionCreateOptions
            {
                Mode = "subscription",
                PaymentMethodTypes = ["card"],
                LineItems =
                [
                    new SessionLineItemOptions
                    {
                        Price = priceId,
                        Quantity = 1,
                    }
                ],
                SuccessUrl = successUrl,
                CancelUrl = cancelUrl,
                CustomerEmail = string.IsNullOrWhiteSpace(stripeCustomerId) ? userEmail : null,
                Customer = stripeCustomerId,
                AllowPromotionCodes = true,
            };

            var service = new SessionService();
            var session = await service.CreateAsync(options, cancellationToken: cancellationToken);

            _logger.LogInformation("[Stripe] Checkout session created: {SessionId}", session.Id);
            return new CheckoutSessionResult(session.Url, session.Id);
        }

        public async Task<BillingPortalResult> CreateBillingPortalSessionAsync(
            string stripeCustomerId,
            string returnUrl,
            CancellationToken cancellationToken = default)
        {
            var options = new Stripe.BillingPortal.SessionCreateOptions
            {
                Customer = stripeCustomerId,
                ReturnUrl = returnUrl,
            };

            var service = new Stripe.BillingPortal.SessionService();
            var session = await service.CreateAsync(options, cancellationToken: cancellationToken);

            _logger.LogInformation("[Stripe] Billing portal session created for customer {CustomerId}", stripeCustomerId);
            return new BillingPortalResult(session.Url);
        }

        public async Task<string?> GetCustomerIdFromCheckoutSessionAsync(
            string sessionId,
            CancellationToken cancellationToken = default)
        {
            var service = new SessionService();
            var session = await service.GetAsync(sessionId, cancellationToken: cancellationToken);
            return session.CustomerId;
        }
    }
}