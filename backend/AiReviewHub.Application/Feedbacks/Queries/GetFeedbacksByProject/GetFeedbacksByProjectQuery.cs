using AiReviewHub.Application.Common.Models;
using AiReviewHub.Domain.Enums;
using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Feedbacks.Queries.GetFeedbacksByProject
{
    public record GetFeedbacksByProjectQuery(
        Guid ProjectId,
        FeedbackStatus? StatusFilter = null,
        FeedbackCategory? CategoryFilter = null,
        FeedbackPriority? PriorityFilter = null,
        string? Search = null,
        string? SortBy = null, 
        bool? ActionRequired = null,
        string? Sentiment = null, 
        int? MinScore = null, 
        int Page = 1,
        int PageSize = 20
    ) : IRequest<PagedResult<FeedbackDto>>;

    public record GetFeedbacksByProjectResult(
        IReadOnlyList<FeedbackDto> Feedbacks,
        int TotalCount
    );

    public record FeedbackDto(
        Guid Id,
        string Content,
        string AiSummary,
        string Category,
        string Priority,
        string Status,
        string AiAnalysisStatus,
        // Champs Pro — null si Free
        int? PriorityScore,
        string? Sentiment,
        int? SentimentScore,
        string[] KeyTopics,
        bool? ActionRequired,
        string? Urgency,
        DateTime CreatedAt,
        DateTime? UpdatedAt
    );
}
