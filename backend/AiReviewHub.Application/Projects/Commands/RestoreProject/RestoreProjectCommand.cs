using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Projects.Commands.RestoreProject
{
    public record RestoreProjectCommand(Guid ProjectId) : IRequest<Unit>;
}
