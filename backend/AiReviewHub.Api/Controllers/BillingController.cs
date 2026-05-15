using AiReviewHub.Application.Billing.Commands.CreateBillingPortalSession;
using AiReviewHub.Application.Billing.Commands.CreateCheckoutSession;
using AiReviewHub.Application.Billing.Commands.HandleStripeWebhook;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stripe.Forwarding;

namespace AiReviewHub.Api.Controllers
{
    [ApiController]
    [Route("api/billing")]
    public class BillingController : ControllerBase
    {
        private readonly IMediator _mediator;

        public BillingController(IMediator mediator)
        {
            _mediator = mediator;
        }

        // ── POST /api/billing/checkout ────────────────────────
        [Authorize]
        [HttpPost("checkout")]
        public async Task<IActionResult> CreateCheckoutSession(
            [FromBody] CreateCheckoutSessionRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _mediator.Send(
                new CreateCheckoutSessionCommand(
                    request.PriceId,
                    request.SuccessUrl,
                    request.CancelUrl),
                cancellationToken);

            return Ok(new { url = result.Url });
        }

        // ── POST /api/billing/portal ──────────────────────────
        [Authorize]
        [HttpPost("portal")]
        public async Task<IActionResult> CreateBillingPortalSession(
            [FromBody] CreateBillingPortalRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _mediator.Send(
                new CreateBillingPortalSessionCommand(request.ReturnUrl),
                cancellationToken);

            return Ok(new { url = result.Url });
        }

        // ── POST /api/billing/webhook ─────────────────────────
        [AllowAnonymous]
        [HttpPost("webhook")]
        public async Task<IActionResult> HandleWebhook(CancellationToken cancellationToken)
        {
            var payload = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync(cancellationToken);
            var signature = Request.Headers["Stripe-Signature"].FirstOrDefault() ?? string.Empty;

            try
            {
                await _mediator.Send(
                    new HandleStripeWebhookCommand(payload, signature),
                    cancellationToken);

                return Ok();
            }
            catch (UnauthorizedAccessException)
            {
                return BadRequest("Invalid webhook signature");
            }
        }

        // ── DTOs ─────────────────────────────────────────────
        public record CreateCheckoutSessionRequest(string PriceId, string SuccessUrl, string CancelUrl);
        public record CreateBillingPortalRequest(string ReturnUrl);
    }
}
