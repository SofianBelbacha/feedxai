using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Abstractions
{
    public record CheckoutSessionResult(string Url, string SessionId);
    public record BillingPortalResult(string Url);

    public interface IStripeService
    {
        Task<CheckoutSessionResult> CreateCheckoutSessionAsync(
            string userEmail,
            string? stripeCustomerId,
            string priceId,
            string successUrl,
            string cancelUrl,
            CancellationToken cancellationToken = default);

        Task<BillingPortalResult> CreateBillingPortalSessionAsync(
            string stripeCustomerId,
            string returnUrl,
            CancellationToken cancellationToken = default);

        Task<string?> GetCustomerIdFromCheckoutSessionAsync(
            string sessionId,
            CancellationToken cancellationToken = default);
    }
}