using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Projects.Commands.RestoreProject
{
    public class RestoreProjectHandler : IRequestHandler<RestoreProjectCommand, Unit>
    {
        private readonly IAppDbContext _context;
        private readonly ICurrentUserService _currentUser;
        private readonly IDateTimeProvider _dateTimeProvider;

        public RestoreProjectHandler(
            IAppDbContext context,
            ICurrentUserService currentUser,
            IDateTimeProvider dateTimeProvider)
        {
            _context = context;
            _currentUser = currentUser;
            _dateTimeProvider = dateTimeProvider;
        }

        public async Task<Unit> Handle(
            RestoreProjectCommand request,
            CancellationToken cancellationToken)
        {
            // IgnoreQueryFilters() nécessaire pour accéder aux projets supprimés
            var project = await _context.Projects
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(p =>
                    p.Id == request.ProjectId &&
                    p.UserId == _currentUser.UserId &&
                    p.DeletedAt != null,
                    cancellationToken)
                ?? throw new NotFoundException($"Deleted project {request.ProjectId} not found");

            project.Restore(_dateTimeProvider);

            await _context.SaveChangesAsync(cancellationToken);

            return Unit.Value;
        }
    }
}
