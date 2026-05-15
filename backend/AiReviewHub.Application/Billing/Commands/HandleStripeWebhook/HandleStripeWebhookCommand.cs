using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Billing.Commands.HandleStripeWebhook
{
    public record HandleStripeWebhookCommand(string Payload, string StripeSignature)
        : IRequest<Unit>;
}
