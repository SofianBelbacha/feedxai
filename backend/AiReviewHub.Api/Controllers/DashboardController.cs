using AiReviewHub.Application.Dashboard.Queries.GetDashboard;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiReviewHub.Api.Controllers
{
    [ApiController]
    [Route("api/dashboard")]
    [Authorize]
    public class DashboardController : ControllerBase
    {
        private readonly IMediator _mediator;

        public DashboardController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpGet]
        public async Task<IActionResult> Get(
            [FromQuery] Guid? projectId,
            [FromQuery] int days = 30,
            CancellationToken cancellationToken = default)
        {
            var result = await _mediator.Send(
                new GetDashboardQuery(projectId, days),
                cancellationToken);

            return Ok(result);
        }
    }
}
