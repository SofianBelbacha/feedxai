using AiReviewHub.Domain.Entities;
using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Projects.Queries.GetWidgetConfig
{
    public record GetWidgetConfigQuery(Guid ProjectId)
        : IRequest<GetWidgetConfigResult>;

    public record GetWidgetConfigResult(
        string PublicToken,
        string Mode,
        string Position,
        string PrimaryColor,
        string Title,
        string Placeholder,
        string ButtonLabel
    );
}
