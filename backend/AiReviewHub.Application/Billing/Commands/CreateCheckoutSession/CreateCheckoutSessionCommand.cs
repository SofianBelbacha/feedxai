using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Billing.Commands.CreateCheckoutSession
{
    public record CreateCheckoutSessionCommand(string PriceId, string PlanName, string SuccessUrl, string CancelUrl)
        : IRequest<CreateCheckoutSessionResult>;

    public record CreateCheckoutSessionResult(string Url);
}
