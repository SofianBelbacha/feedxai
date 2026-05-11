using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;

namespace AiReviewHub.Application.Projects.Commands.SaveWidgetConfig
{
    public class SaveWidgetConfigHandler
        : IRequestHandler<SaveWidgetConfigCommand, Unit>
    {
        private readonly IAppDbContext _context;
        private readonly ICurrentUserService _currentUser;
        private readonly IDateTimeProvider _dateTimeProvider;

        public SaveWidgetConfigHandler(
            IAppDbContext context,
            ICurrentUserService currentUser,
            IDateTimeProvider dateTimeProvider)
        {
            _context = context;
            _currentUser = currentUser;
            _dateTimeProvider = dateTimeProvider;
        }

        public async Task<Unit> Handle(
            SaveWidgetConfigCommand request,
            CancellationToken cancellationToken)
        {
            var project = await _context.Projects
                .FirstOrDefaultAsync(p =>
                    p.Id == request.ProjectId &&
                    p.UserId == _currentUser.UserId,
                    cancellationToken)
                ?? throw new NotFoundException("Project not found");

            // Valide les valeurs
            var validModes = new[] { "floating", "inline", "both" };
            var validPositions = new[] { "bottom-right", "bottom-left" };

            if (!validModes.Contains(request.Mode))
                throw new ArgumentException("Invalid mode");

            if (!validPositions.Contains(request.Position))
                throw new ArgumentException("Invalid position");

            var configJson = JsonSerializer.Serialize(new
            {
                request.Mode,
                request.Position,
                request.PrimaryColor,
                request.Title,
                request.Placeholder,
                request.ButtonLabel
            });

            project.SaveWidgetConfig(configJson, _dateTimeProvider.UtcNow);
            await _context.SaveChangesAsync(cancellationToken);

            return Unit.Value;
        }
    }
}
