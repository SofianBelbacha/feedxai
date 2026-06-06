using AiReviewHub.Application.Trends.Queries.GetTrends;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiReviewHub.Api.Controllers
{
    [ApiController]
    [Route("api/trends")]
    [Authorize]
    public class TrendsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public TrendsController(IMediator mediator) => _mediator = mediator;

        [HttpGet]
        public async Task<IActionResult> Get(
            [FromQuery] int days = 30,
            [FromQuery] Guid? projectId = null,
            [FromQuery] string? category = null,
            [FromQuery] string? priority = null,
            CancellationToken cancellationToken = default)
        {
            var result = await _mediator.Send(
                new GetTrendsQuery(days, projectId, category, priority),
                cancellationToken);

            return Ok(result);
        }
    }
}
