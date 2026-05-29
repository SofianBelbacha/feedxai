using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Projects.Commands.UpdateProject
{
    public record UpdateProjectCommand(
        Guid ProjectId,
        string Name,
        string Description
    ) : IRequest<UpdateProjectResult>;

    public record UpdateProjectResult(Guid Id, string Name, string Description);
}
