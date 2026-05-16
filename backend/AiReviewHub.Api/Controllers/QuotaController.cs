using AiReviewHub.Application.Users.Queries.GetQuota;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiReviewHub.Api.Controllers
{
    [ApiController]
    [Route("api/quota")]
    [Authorize]
    public class QuotaController : ControllerBase
    {
        private readonly IMediator _mediator;
        public QuotaController(IMediator mediator) => _mediator = mediator;

        [HttpGet]
        public async Task<IActionResult> Get(CancellationToken cancellationToken)
        {
            var result = await _mediator.Send(new GetQuotaQuery(), cancellationToken);
            return Ok(result);
        }
    }
}