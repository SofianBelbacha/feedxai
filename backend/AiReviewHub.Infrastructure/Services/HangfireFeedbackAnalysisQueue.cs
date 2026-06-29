using AiReviewHub.Application.Abstractions;
using AiReviewHub.Infrastructure.Jobs;
using Hangfire;

namespace AiReviewHub.Infrastructure.Services;

public class HangfireFeedbackAnalysisQueue : IFeedbackAnalysisQueue
{
    private readonly IBackgroundJobClient _backgroundJobs;

    public HangfireFeedbackAnalysisQueue(IBackgroundJobClient backgroundJobs)
    {
        _backgroundJobs = backgroundJobs;
    }

    public void Enqueue(Guid feedbackId, string plan)
    {
        switch (plan)
        {
            case "Team":
                _backgroundJobs.Enqueue<FeedbackAnalysisJob>(
                    "critical",
                    job => job.AnalyzeFeedbackPriorityAsync(feedbackId, null!));
                break;

            case "Pro":
                _backgroundJobs.Enqueue<FeedbackAnalysisJob>(
                    job => job.AnalyzeFeedbackAsync(feedbackId, null!));
                break;

            default: // Free
                _backgroundJobs.Enqueue<FeedbackAnalysisJob>(
                    "free",
                    job => job.AnalyzeFeedbackFreeAsync(feedbackId, null!));
                break;
        }
    }
}