using AiReviewHub.Application.Projects.Commands.CreateProject;
using AiReviewHub.Application.Projects.Commands.DeactivateProject;
using AiReviewHub.Application.Projects.Commands.RegenerateProjectToken;
using AiReviewHub.Application.Projects.Commands.SaveWidgetConfig;
using AiReviewHub.Application.Projects.Commands.UpdateProject;
using AiReviewHub.Application.Projects.Queries.GetProjectsByUser;
using AiReviewHub.Application.Projects.Queries.GetWidgetConfig;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiReviewHub.Api.Controllers
{
    [ApiController]
    [Route("api/projects")]
    [Authorize]
    public class ProjectsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public ProjectsController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateProjectRequest request, CancellationToken cancellationToken)
        {
            var result = await _mediator.Send(new CreateProjectCommand(request.Name, request.Description), cancellationToken);

            return CreatedAtAction(nameof(GetAll), new { id = result.Id }, result);
        }

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default)
        {
            var result = await _mediator.Send(
                new GetProjectsByUserQuery(page, pageSize),
                cancellationToken);

            return Ok(result);
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
        {
            await _mediator.Send(
                new DeactivateProjectCommand(id), cancellationToken);
            return NoContent();
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProjectRequest request, CancellationToken cancellationToken)
        {
            var result = await _mediator.Send(
                new UpdateProjectCommand(id, request.Name, request.Description),
                cancellationToken);

            return Ok(result);
        }


        [HttpPost("{id:guid}/regenerate-token")]
        public async Task<IActionResult> RegenerateToken(
            Guid id,
            CancellationToken cancellationToken)
        {
            var result = await _mediator.Send(
                new RegenerateProjectTokenCommand(id), cancellationToken);
            return Ok(new { publicToken = result.PublicToken });
        }

        [HttpGet("{id:guid}/widget-config")]
        public async Task<IActionResult> GetWidgetConfig(
            Guid id, CancellationToken cancellationToken)
        {
            var result = await _mediator.Send(
                new GetWidgetConfigQuery(id), cancellationToken);
            return Ok(result);
        }

        [HttpPut("{id:guid}/widget-config")]
        public async Task<IActionResult> SaveWidgetConfig(
            Guid id,
            [FromBody] SaveWidgetConfigRequest request,
            CancellationToken cancellationToken)
        {
            await _mediator.Send(
                new SaveWidgetConfigCommand(
                    id,
                    request.Mode,
                    request.Position,
                    request.PrimaryColor,
                    request.Title,
                    request.Placeholder,
                    request.ButtonLabel),
                cancellationToken);
            return NoContent();
        }
    }
    public record CreateProjectRequest(string Name, string Description);
    public record SaveWidgetConfigRequest(string Mode, string Position, string PrimaryColor, string Title, string Placeholder, string ButtonLabel);
    public record UpdateProjectRequest(string Name, string Description);

}
