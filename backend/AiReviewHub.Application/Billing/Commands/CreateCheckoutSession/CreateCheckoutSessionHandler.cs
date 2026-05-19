using AiReviewHub.Application.Abstractions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Billing.Commands.CreateCheckoutSession
{
    public class CreateCheckoutSessionHandler
        : IRequestHandler<CreateCheckoutSessionCommand, CreateCheckoutSessionResult>
    {
        private readonly IAppDbContext _context;
        private readonly ICurrentUserService _currentUser;
        private readonly IStripeService _stripeService;

        public CreateCheckoutSessionHandler(
            IAppDbContext context,
            ICurrentUserService currentUser,
            IStripeService stripeService)
        {
            _context = context;
            _currentUser = currentUser;
            _stripeService = stripeService;
        }

        public async Task<CreateCheckoutSessionResult> Handle(
            CreateCheckoutSessionCommand request,
            CancellationToken cancellationToken)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == _currentUser.UserId, cancellationToken)
                ?? throw new UnauthorizedAccessException("User not found");

            var result = await _stripeService.CreateCheckoutSessionAsync(
                user.Email.Value,
                user.StripeCustomerId,
                request.PriceId,
                request.PlanName,
                request.SuccessUrl,
                request.CancelUrl,
                cancellationToken);

            return new CreateCheckoutSessionResult(result.Url);
        }
    }
}