using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Entities;
using AiReviewHub.Domain.Exceptions;
using Hangfire;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Stripe.V2;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Widget.Commands.SubmitWidgetFeedback
{
    public class SubmitWidgetFeedbackHandler
    : IRequestHandler<SubmitWidgetFeedbackCommand, SubmitWidgetFeedbackResult>
    {
        private readonly IAppDbContext _context;
        private readonly IDateTimeProvider _dateTimeProvider;
        private readonly IBackgroundJobClient _backgroundJobs;
        private readonly IFeedbackAnalysisQueue _analysisQueue; // interface Application
        private readonly IWidgetProtectionService _widgetProtection;


        public SubmitWidgetFeedbackHandler(
            IAppDbContext context,
            IDateTimeProvider dateTimeProvider,
            IBackgroundJobClient backgroundJobs,
            IFeedbackAnalysisQueue analysisQueue,
            IWidgetProtectionService widgetProtection)
        {
            _context = context;
            _dateTimeProvider = dateTimeProvider;
            _backgroundJobs = backgroundJobs;
            _analysisQueue = analysisQueue;
            _widgetProtection = widgetProtection;
        }

        public async Task<SubmitWidgetFeedbackResult> Handle(SubmitWidgetFeedbackCommand request, CancellationToken cancellationToken)
        {
            // Honeypot — bot détecté
            // Retourner 200 OK silencieux
            if (!string.IsNullOrEmpty(request.Website))
            {
                return new SubmitWidgetFeedbackResult(Guid.NewGuid());
            }

            // Trouve le projet via le token public
            var project = await _context.Projects
                .Include(p => p.User)
                .FirstOrDefaultAsync(p =>
                    p.PublicToken == request.ProjectToken &&
                    p.IsActive,
                    cancellationToken)
                ?? throw new NotFoundException("Project not found or inactive");

            // 3. Protection quota journalier par projet
            var canAccept = await _widgetProtection.CanAcceptSubmissionAsync(
                project.Id,
                project.User.Plan,
                cancellationToken);

            if (!canAccept)
            {
                // 429 silencieux — ne pas révéler la limite au bot
                throw new Domain.Exceptions.RateLimitException("Daily submission limit reached for this project.");
            }


            var feedback = Feedback.Create(
                request.Content,
                project.Id,
                _dateTimeProvider.UtcNow
            );

            _context.Feedbacks.Add(feedback);
            await _context.SaveChangesAsync(cancellationToken);


            // Enqueue l'analyse IA selon le plan
            _analysisQueue.Enqueue(feedback.Id, project.User.Plan.ToString());


            return new SubmitWidgetFeedbackResult(feedback.Id);
        }
    }
}
