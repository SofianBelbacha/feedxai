using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Projects.Commands.DeleteProject
{
    public record DeleteProjectCommand(Guid ProjectId) : IRequest<Unit>;
}
