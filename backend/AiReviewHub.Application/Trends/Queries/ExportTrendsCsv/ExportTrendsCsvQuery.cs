using AiReviewHub.Domain.Enums;
using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Trends.Queries.ExportTrendsCsv
{
    public record ExportTrendsCsvQuery(
        int Days,
        Guid? ProjectId = null,
        FeedbackCategory? Category = null,
        FeedbackPriority? Priority = null
    ) : IRequest<ExportTrendsCsvResult>;

    public record ExportTrendsCsvResult(
        byte[] Content,
        string FileName
    );
}
