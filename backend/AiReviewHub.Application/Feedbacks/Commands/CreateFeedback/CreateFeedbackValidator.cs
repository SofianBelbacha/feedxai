using AiReviewHub.Domain.ValueObjects;
using FluentValidation;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Feedbacks.Commands.CreateFeedback
{
    public class CreateFeedbackValidator : AbstractValidator<CreateFeedbackCommand>
    {
        public CreateFeedbackValidator()
        {
            RuleFor(x => x.Content)
                .NotEmpty()
                .MinimumLength(FeedbackContent.MinLength)
                .MaximumLength(FeedbackContent.MaxLength);

            RuleFor(x => x.ProjectId)
                .NotEmpty().WithMessage("ProjectId is required");
        }
    }
}
