using AiReviewHub.Application.Feedbacks.Commands.CreateFeedback;
using AiReviewHub.Application.Feedbacks.Commands.UpdateFeedbackStatus;
using AiReviewHub.Application.Feedbacks.Queries.ExportFeedbacksCsv;
using AiReviewHub.Application.Feedbacks.Queries.GetFeedbacksByProject;
using AiReviewHub.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiReviewHub.Api.Controllers
{
    [ApiController]
    [Route("api/projects/{projectId:guid}/feedbacks")]
    [Authorize]
    public class FeedbacksController : ControllerBase
    {
        private readonly IMediator _mediator;

        public FeedbacksController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll(
            Guid projectId,
            [FromQuery] string? search = null,
            [FromQuery] string? status = null,
            [FromQuery] string? category = null,
            [FromQuery] string? priority = null,
            [FromQuery] string? sortBy = null,
            [FromQuery] bool? actionRequired = null,
            [FromQuery] string? sentiment = null,
            [FromQuery] int? minScore = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            CancellationToken cancellationToken = default)
        {
            Enum.TryParse<FeedbackStatus>(status, out var statusEnum);
            Enum.TryParse<FeedbackCategory>(category, out var categoryEnum);
            Enum.TryParse<FeedbackPriority>(priority, out var priorityEnum);

            var result = await _mediator.Send(new GetFeedbacksByProjectQuery(
                ProjectId: projectId,
                StatusFilter: string.IsNullOrEmpty(status) ? null : statusEnum,
                CategoryFilter: string.IsNullOrEmpty(category) ? null : categoryEnum,
                PriorityFilter: string.IsNullOrEmpty(priority) ? null : priorityEnum,
                Search: search,
                SortBy: sortBy,
                ActionRequired: actionRequired,
                Sentiment: sentiment,
                MinScore: minScore,
                Page: page,
                PageSize: pageSize
            ), cancellationToken);

            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> Create(Guid projectId, [FromBody] CreateFeedbackRequest request, CancellationToken cancellationToken)
        {
            var result = await _mediator.Send(
                new CreateFeedbackCommand(request.Content, projectId),
                cancellationToken);

            return CreatedAtAction(nameof(GetAll), new { projectId, feedbackId = result.Id }, result);
        }

        [HttpPatch("{feedbackId:guid}/status")]
        public async Task<IActionResult> UpdateStatus(
            Guid projectId,
            Guid feedbackId,
            [FromBody] UpdateFeedbackStatusRequest request,
            CancellationToken cancellationToken)
        {
            await _mediator.Send(new UpdateFeedbackStatusCommand(feedbackId, projectId, request.NewStatus), cancellationToken);

            return NoContent();
        }

        [HttpGet("export")]
        public async Task<IActionResult> Export(
            Guid projectId,
            [FromQuery] FeedbackStatus? status = null,
            [FromQuery] FeedbackCategory? category = null,
            [FromQuery] FeedbackPriority? priority = null,
            CancellationToken cancellationToken = default)
        {
            var result = await _mediator.Send(
                new ExportFeedbacksCsvQuery(projectId, status, category, priority),
                cancellationToken);

            return File(
                result.Content,
                "text/csv; charset=utf-8",
                result.FileName);
        }
    }

    // DTOs de requête spécifiques au controller
    public record CreateFeedbackRequest(string Content);
    public record UpdateFeedbackStatusRequest(FeedbackStatus NewStatus);
}
