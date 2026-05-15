using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Billing.Commands.CreateBillingPortalSession
{
    namespace AiReviewHub.Application.Billing.Commands.CreateBillingPortalSession
    {
        public class CreateBillingPortalSessionHandler
            : IRequestHandler<CreateBillingPortalSessionCommand, CreateBillingPortalSessionResult>
        {
            private readonly IAppDbContext _context;
            private readonly ICurrentUserService _currentUser;
            private readonly IStripeService _stripeService;

            public CreateBillingPortalSessionHandler(
                IAppDbContext context,
                ICurrentUserService currentUser,
                IStripeService stripeService)
            {
                _context = context;
                _currentUser = currentUser;
                _stripeService = stripeService;
            }

            public async Task<CreateBillingPortalSessionResult> Handle(
                CreateBillingPortalSessionCommand request,
                CancellationToken cancellationToken)
            {
                var user = await _context.Users
                    .FirstOrDefaultAsync(u => u.Id == _currentUser.UserId, cancellationToken)
                    ?? throw new UnauthorizedAccessException("User not found");

                if (string.IsNullOrWhiteSpace(user.StripeCustomerId))
                    throw new NotFoundException("No active Stripe subscription found for this user.");

                var result = await _stripeService.CreateBillingPortalSessionAsync(
                    user.StripeCustomerId,
                    request.ReturnUrl,
                    cancellationToken);

                return new CreateBillingPortalSessionResult(result.Url);
            }
        }
    }
}
