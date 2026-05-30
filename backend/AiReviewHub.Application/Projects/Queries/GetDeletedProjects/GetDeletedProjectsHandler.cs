using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Projects.Queries.GetDeletedProjects
{
    public class GetDeletedProjectsHandler
        : IRequestHandler<GetDeletedProjectsQuery, List<DeletedProjectResult>>
    {
        private readonly IAppDbContext _context;
        private readonly ICurrentUserService _currentUser;
        private readonly IDateTimeProvider _dateTime;

        public GetDeletedProjectsHandler(
            IAppDbContext context,
            ICurrentUserService currentUser,
            IDateTimeProvider dateTime)
        {
            _context = context;
            _currentUser = currentUser;
            _dateTime = dateTime;
        }

        public async Task<List<DeletedProjectResult>> Handle(
            GetDeletedProjectsQuery request,
            CancellationToken cancellationToken)
        {
            var now = _dateTime.UtcNow;

            return await _context.Projects
                .IgnoreQueryFilters()
                .Where(p =>
                    p.UserId == _currentUser.UserId &&
                    p.DeletedAt != null)
                .OrderByDescending(p => p.DeletedAt)
                .Select(p => new DeletedProjectResult(
                    p.Id,
                    p.Name,
                    p.Description,
                    p.DeletedAt!.Value,
                    p.DeletedAt!.Value.AddDays(30),
                    Math.Max(0, (int)(p.DeletedAt!.Value.AddDays(30) - now).TotalDays)
                ))
                .ToListAsync(cancellationToken);
        }
    }
}
