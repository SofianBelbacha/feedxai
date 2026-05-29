using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Projects.Commands.UpdateProject
{
    public class UpdateProjectHandler : IRequestHandler<UpdateProjectCommand, UpdateProjectResult>
    {
        private readonly IAppDbContext _context;
        private readonly ICurrentUserService _currentUser;
        private readonly IDateTimeProvider _dateTimeProvider;

        public UpdateProjectHandler(
            IAppDbContext context,
            ICurrentUserService currentUser,
            IDateTimeProvider dateTimeProvider)
        {
            _context = context;
            _currentUser = currentUser;
            _dateTimeProvider = dateTimeProvider;
        }

        public async Task<UpdateProjectResult> Handle(
            UpdateProjectCommand request,
            CancellationToken cancellationToken)
        {
            var project = await _context.Projects
                .FirstOrDefaultAsync(p =>
                    p.Id == request.ProjectId &&
                    p.UserId == _currentUser.UserId &&
                    p.IsActive,
                    cancellationToken)
                ?? throw new NotFoundException($"Project {request.ProjectId} not found or inactive");

            project.Update(request.Name, request.Description, _dateTimeProvider);

            await _context.SaveChangesAsync(cancellationToken);

            return new UpdateProjectResult(project.Id, project.Name, project.Description);
        }
    }
}
