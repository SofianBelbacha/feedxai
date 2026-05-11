using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;

namespace AiReviewHub.Application.Projects.Queries.GetWidgetConfig
{
    public class GetWidgetConfigHandler
        : IRequestHandler<GetWidgetConfigQuery, GetWidgetConfigResult>
    {
        private readonly IAppDbContext _context;
        private readonly ICurrentUserService _currentUser;

        public GetWidgetConfigHandler(
            IAppDbContext context,
            ICurrentUserService currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<GetWidgetConfigResult> Handle(
            GetWidgetConfigQuery request,
            CancellationToken cancellationToken)
        {
            var project = await _context.Projects
                .AsNoTracking()
                .FirstOrDefaultAsync(p =>
                    p.Id == request.ProjectId &&
                    p.UserId == _currentUser.UserId,
                    cancellationToken)
                ?? throw new NotFoundException("Project not found");

            // Config par défaut si jamais sauvegardée
            if (string.IsNullOrEmpty(project.WidgetConfigJson))
            {
                return new GetWidgetConfigResult(
                    project.PublicToken,
                    Mode: "floating",
                    Position: "bottom-right",
                    PrimaryColor: "#3B82F6",
                    Title: "Votre avis compte",
                    Placeholder: "Décrivez votre retour, bug ou suggestion…",
                    ButtonLabel: "Feedback"
                );
            }

            var config = JsonSerializer.Deserialize<WidgetConfigJson>(
                project.WidgetConfigJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                ?? throw new InvalidOperationException("Invalid widget config");

            return new GetWidgetConfigResult(
                project.PublicToken,
                config.Mode,
                config.Position,
                config.PrimaryColor,
                config.Title,
                config.Placeholder,
                config.ButtonLabel
            );
        }

        private record WidgetConfigJson(
            string Mode,
            string Position,
            string PrimaryColor,
            string Title,
            string Placeholder,
            string ButtonLabel
        );
    }
}
