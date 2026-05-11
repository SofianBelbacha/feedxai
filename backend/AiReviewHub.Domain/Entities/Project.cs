using AiReviewHub.Domain.Abstractions;
using System.Security.Cryptography;

namespace AiReviewHub.Domain.Entities
{
    public class Project
    {
        public const int MaxNameLength = 100;
        public const int MaxDescriptionLength = 500;

        public Guid Id { get; private set; }
        public string Name { get; private set; } = string.Empty;
        public string Description { get; private set; } = string.Empty;
        public string PublicToken { get; private set; } = string.Empty;
        public bool IsActive { get; private set; }
        public DateTime CreatedAt { get; private set; }
        public DateTime? UpdatedAt { get; private set; }

        public Guid UserId { get; private set; }
        public User User { get; private set; } = null!;
        public string? WidgetConfigJson { get; private set; }

        public ICollection<Feedback> Feedbacks { get; private set; } = [];

        private Project() { }

        public static Project Create(string name, string description, Guid userId, DateTime now)
        {
            ValidateName(name);
            ValidateDescription(description);

            if (userId == Guid.Empty)
                throw new ArgumentException("UserId cannot be empty");

            now = DateTime.SpecifyKind(now, DateTimeKind.Utc);

            return new Project
            {
                Id = Guid.NewGuid(),
                Name = name.Trim(),
                Description = description.Trim(),
                PublicToken = GenerateToken(),
                IsActive = true,
                UserId = userId,
                CreatedAt = now,
                UpdatedAt = now
            };
        }

        public void Update(string name, string description, IDateTimeProvider dateTimeProvider)
        {
            ValidateName(name);
            ValidateDescription(description);

            Name = name.Trim();
            Description = description.Trim();
            UpdatedAt = dateTimeProvider.UtcNow;
        }

        public void RegenerateToken(IDateTimeProvider dateTimeProvider)
        {
            PublicToken = GenerateToken();
            UpdatedAt = dateTimeProvider.UtcNow;
        }

        public void Deactivate(IDateTimeProvider dateTimeProvider)
        {
            if (!IsActive)
                throw new InvalidOperationException("Project is already inactive");

            IsActive = false;
            UpdatedAt = dateTimeProvider.UtcNow;
        }

        private static string GenerateToken() =>
            Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLower();

        private static void ValidateName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Project name cannot be empty");

            if (name.Length > MaxNameLength)
                throw new ArgumentException($"Project name cannot exceed {MaxNameLength} characters");
        }

        private static void ValidateDescription(string description)
        {
            if (description.Length > MaxDescriptionLength)
                throw new ArgumentException($"Description cannot exceed {MaxDescriptionLength} characters");
        }

        public void SaveWidgetConfig(string configJson, DateTime now)
        {
            WidgetConfigJson = configJson;
            UpdatedAt = now;
        }
    }
}