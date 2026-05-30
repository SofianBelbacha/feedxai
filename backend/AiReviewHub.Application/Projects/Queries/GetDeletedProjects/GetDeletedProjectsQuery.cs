using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Projects.Queries.GetDeletedProjects
{
    public record GetDeletedProjectsQuery : IRequest<List<DeletedProjectResult>>;

    public record DeletedProjectResult(
        Guid Id,
        string Name,
        string Description,
        DateTime DeletedAt,
        DateTime PurgeDate,      // DeletedAt + 30 jours
        int DaysUntilPurge);
}
