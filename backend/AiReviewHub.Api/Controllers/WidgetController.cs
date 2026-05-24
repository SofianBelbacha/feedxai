using AiReviewHub.Application.Widget.Commands.SubmitWidgetFeedback;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AiReviewHub.Api.Controllers
{

    [ApiController]
    [Route("api/widget")]
    [AllowAnonymous] // ← public — pas d'auth requise
    [EnableCors("Widget")] // ← policy spécifique
    public class WidgetController : ControllerBase
    {
        private readonly IMediator _mediator;

        public WidgetController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpPost("feedback")]
        [EnableRateLimiting("widget_ip")]
        public async Task<IActionResult> Submit(
            [FromBody] SubmitWidgetFeedbackRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _mediator.Send(
                new SubmitWidgetFeedbackCommand(
                    request.Content,
                    request.ProjectToken,
                    request.Category,
                    request.PageUrl,
                    request.UserAgent),
                cancellationToken);

            return Ok(new { id = result.Id });
        }
    }

    public record SubmitWidgetFeedbackRequest(
        string Content,
        string ProjectToken,
        string? Category = null,
        string? PageUrl = null,
        string? UserAgent = null,
        string? Website = null
    );
}
