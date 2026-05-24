using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Widget.Commands.SubmitWidgetFeedback
{
    public record SubmitWidgetFeedbackCommand(
        string Content,
        string ProjectToken,
        string? Category = null,
        string? PageUrl = null,
        string? UserAgent = null,
        string? Website = null
    ) : IRequest<SubmitWidgetFeedbackResult>;

    public record SubmitWidgetFeedbackResult(Guid Id);
}
