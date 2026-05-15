using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Billing.Commands.CreateBillingPortalSession
{
    public record CreateBillingPortalSessionCommand(string ReturnUrl)
        : IRequest<CreateBillingPortalSessionResult>;

    public record CreateBillingPortalSessionResult(string Url);
}
