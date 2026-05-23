using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Enums;
using AiReviewHub.Infrastructure.Persistence;
using AiReviewHub.Infrastructure.Services;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AiReviewHub.Infrastructure.Jobs;

public class FeedbackAnalysisJob
{
    private readonly IAppDbContext _context;
    private readonly IAiAnalysisService _aiService;
    private readonly IAiQuotaService _quotaService;
    private readonly IDateTimeProvider _dateTimeProvider;
    private readonly ILogger<FeedbackAnalysisJob> _logger;
    private readonly CancellationToken cancellationToken;

    public FeedbackAnalysisJob(
        IAppDbContext context,
        IAiAnalysisService aiService,
        IAiQuotaService quotaService,
        IDateTimeProvider dateTimeProvider,
        ILogger<FeedbackAnalysisJob> logger)
    {
        _context = context;
        _aiService = aiService;
        _quotaService = quotaService;
        _dateTimeProvider = dateTimeProvider;
        _logger = logger;
    }

    // ─── Entrées par plan ────────────────────────────────────

    [Queue("critical")]
    public Task AnalyzeFeedbackPriorityAsync(Guid feedbackId)
        => AnalyzeFeedbackInternalAsync(feedbackId);

    [Queue("default")]
    [AutomaticRetry(Attempts = 3, DelaysInSeconds = [30, 60, 120])]
    public Task AnalyzeFeedbackAsync(Guid feedbackId)
        => AnalyzeFeedbackInternalAsync(feedbackId);

    [Queue("free")]
    [AutomaticRetry(Attempts = 2, DelaysInSeconds = [60, 180])]
    public Task AnalyzeFeedbackFreeAsync(Guid feedbackId)
        => AnalyzeFeedbackInternalAsync(feedbackId);

    // ─── Logique commune ─────────────────────────────────────

    private async Task AnalyzeFeedbackInternalAsync(Guid feedbackId)
    {
        var now = _dateTimeProvider.UtcNow;

        // Charge le feedback avec son projet et son user
        var feedback = await _context.Feedbacks
            .Include(f => f.Project)
                .ThenInclude(p => p.User)
            .FirstOrDefaultAsync(f => f.Id == feedbackId);

        if (feedback is null)
        {
            _logger.LogWarning(
                "[AI] Feedback {FeedbackId} not found — skipping", feedbackId);
            return;
        }

        // ── Idempotence ───────────────────────────────────────
        if (feedback.AiAnalysisStatus == AiAnalysisStatus.Completed)
        {
            _logger.LogInformation(
                "[AI] Feedback {FeedbackId} already completed — skipping", feedbackId);
            return;
        }

        if (feedback.AiAnalysisStatus == AiAnalysisStatus.Processing)
        {
            // Détecte un job bloqué — processing depuis plus de 2 minutes
            var isStuck = feedback.UpdatedAt.HasValue &&
                          (now - feedback.UpdatedAt.Value).TotalMinutes > 2;

            if (!isStuck)
            {
                _logger.LogInformation(
                    "[AI] Feedback {FeedbackId} already processing — skipping", feedbackId);
                return;
            }

            _logger.LogWarning(
                "[AI] Feedback {FeedbackId} stuck in Processing — restarting", feedbackId);
        }

        // ── Quota ─────────────────────────────────────────────
        var user = feedback.Project?.User
            ?? throw new InvalidOperationException(
                $"Feedback {feedbackId} has no associated user");

        if (!await _quotaService.TryConsumeAsync(user.Id, user.Plan, cancellationToken))
        {
            _logger.LogWarning(
                "[AI] Daily quota reached for user {UserId} (plan: {Plan})",
                user.Id, user.Plan);

            feedback.MarkAsFailed("Quota journalier d'analyse IA atteint", now);
            await SaveChangesAsync();
            return;
        }

        // ── Processing ────────────────────────────────────────
        _logger.LogInformation(
            "[AI] Starting analysis for feedback {FeedbackId}", feedbackId);

        feedback.MarkAsProcessing(now);
        await SaveChangesAsync();

        try
        {
            var result = await _aiService.AnalyzeAsync(
                feedback.Content.Value, user?.Plan ?? Plan.Free);

            feedback.EnrichWithAi(
                result.Category,
                result.Priority,
                result.Summary,
                _dateTimeProvider.UtcNow,
                result.PriorityScore,
                result.Sentiment,
                result.SentimentScore,
                result.KeyTopics,
                result.ActionRequired,
                result.Urgency
            );

            await SaveChangesAsync();

            _logger.LogInformation(
                "[AI] Feedback {FeedbackId} analyzed successfully — " +
                "Category: {Category}, Priority: {Priority}",
                feedbackId, result.Category, result.Priority);
        }
        catch (Exception ex)
        {
            var safeError = GetSafeErrorMessage(ex);

            _logger.LogError(ex,
                "[AI] Failed to analyze feedback {FeedbackId}: {Message}",
                feedbackId, ex.Message);

            feedback.MarkAsFailed(safeError, _dateTimeProvider.UtcNow);
            await SaveChangesAsync();

            throw; // Hangfire gère le retry
        }
    }

    // ─── Helpers ─────────────────────────────────────────────

    private Task SaveChangesAsync() =>
        ((AppDbContext)_context).SaveChangesAsync();

    private static string GetSafeErrorMessage(Exception ex) => ex switch
    {
        TimeoutException => "Timeout de l'analyse IA",
        HttpRequestException => "Erreur réseau lors de l'analyse IA",
        InvalidOperationException e when
            e.Message.Contains("parse") ||
            e.Message.Contains("JSON") => "Réponse IA invalide",
        InvalidOperationException e when
            e.Message.Contains("retry") => "Analyse IA échouée après plusieurs tentatives",
        OperationCanceledException => "Analyse IA annulée (timeout)",
        _ => "Erreur interne lors de l'analyse IA"
    };
}