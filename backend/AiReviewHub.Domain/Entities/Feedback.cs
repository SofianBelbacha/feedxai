using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Enums;
using AiReviewHub.Domain.ValueObjects;

namespace AiReviewHub.Domain.Entities
{
    public class Feedback
    {
        // Transitions d'état autorisées
        private static readonly Dictionary<FeedbackStatus, FeedbackStatus[]> AllowedTransitions = new()
        {
            { FeedbackStatus.Todo, [FeedbackStatus.InProgress] },
            { FeedbackStatus.InProgress, [FeedbackStatus.Todo, FeedbackStatus.Done] },
            { FeedbackStatus.Done, [FeedbackStatus.InProgress] }
        };

        public Guid Id { get; private set; }
        public FeedbackContent Content { get; private set; } = null!;
        public FeedbackCategory Category { get; private set; }
        public FeedbackPriority Priority { get; private set; }
        public string AiSummary { get; private set; } = string.Empty;
        public FeedbackStatus Status { get; private set; }
        public DateTime CreatedAt { get; private set; }
        public DateTime? UpdatedAt { get; private set; }
        public DateTime? ResolvedAt { get; private set; }
        public Guid ProjectId { get; private set; }
        public Project Project { get; private set; } = null!;

        public AiAnalysisStatus AiAnalysisStatus { get; private set; }
        public string? AiAnalysisError { get; private set; }

        // ── Champs Pro/Team uniquement ────────────────────────
        public int? PriorityScore { get; private set; } // 0-100
        public string? Sentiment { get; private set; } // Positive/Neutral/Negative/Frustrated
        public int? SentimentScore { get; private set; } // -100 à 100
        public string? KeyTopics { get; private set; } // JSON array stocké en string
        public bool? ActionRequired { get; private set; }
        public string? Urgency { get; private set; } // Low/Medium/High/Immediate



        private Feedback() { }

        public static Feedback Create(string content, Guid projectId, DateTime now)
        {
            if (projectId == Guid.Empty)
                throw new ArgumentException("ProjectId cannot be empty");

            if (string.IsNullOrWhiteSpace(content) || content.Length < 10)
                throw new ArgumentException("Feedback content must be at least 10 characters.");

            now = DateTime.SpecifyKind(now, DateTimeKind.Utc);

            return new Feedback
            {
                Id = Guid.NewGuid(),
                Content = FeedbackContent.Create(content),
                Category = FeedbackCategory.Uncategorized,
                Priority = FeedbackPriority.Normal,
                Status = FeedbackStatus.Todo,
                AiAnalysisStatus = AiAnalysisStatus.Pending, // ← toujours Pending à la création
                AiSummary = string.Empty,
                ProjectId = projectId,
                CreatedAt = now
            };
        }

        public void MarkAsProcessing(DateTime now)
        {
            AiAnalysisStatus = AiAnalysisStatus.Processing;
            UpdatedAt = now;
        }

        public void MarkAsFailed(string error, DateTime now)
        {
            AiAnalysisStatus = AiAnalysisStatus.Failed;
            AiAnalysisError = error;
            UpdatedAt = now;
        }


        public void EnrichWithAi(FeedbackCategory category, FeedbackPriority priority, string summary, DateTime now, 
            int? priorityScore = null,
            string? sentiment = null,
            int? sentimentScore = null,
            string[]? keyTopics = null,
            bool? actionRequired = null,
            string? urgency = null)
        {
            if (string.IsNullOrWhiteSpace(summary))
                throw new ArgumentException("AI summary cannot be empty");

            Category = category;
            Priority = priority;
            AiSummary = summary.Trim();
            AiAnalysisStatus = AiAnalysisStatus.Completed; // ← marque comme complété
            AiAnalysisError = null;
            UpdatedAt = now;

            // Champs Pro
            PriorityScore = priorityScore;
            Sentiment = sentiment;
            SentimentScore = sentimentScore;
            KeyTopics = keyTopics is not null ? System.Text.Json.JsonSerializer.Serialize(keyTopics) : null;
            ActionRequired = actionRequired;
            Urgency = urgency;

        }

        public void UpdateStatus(FeedbackStatus newStatus, DateTime now)
        {
            if (Status == newStatus)
                throw new InvalidOperationException(
                    $"Feedback is already in {newStatus} status");

            if (!AllowedTransitions.TryGetValue(Status, out var allowed) || !allowed.Contains(newStatus))
                throw new InvalidOperationException(
                    $"Cannot transition from {Status} to {newStatus}");

            Status = newStatus;
            UpdatedAt = now;

            // Capturer la date de résolution
            if (newStatus == FeedbackStatus.Done)
                ResolvedAt = now;
            // Si on repasse de Done à InProgress, on efface la date
            else if (ResolvedAt.HasValue)
                ResolvedAt = null;

        }
    }
}