using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Projects.Commands.SaveWidgetConfig
{
    public record SaveWidgetConfigCommand(
        Guid ProjectId,
        string Mode,
        string Position,
        string PrimaryColor,
        string Title,
        string Placeholder,
        string ButtonLabel
    ) : IRequest<Unit>;
}
