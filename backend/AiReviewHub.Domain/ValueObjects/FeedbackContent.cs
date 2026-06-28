using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Domain.ValueObjects
{
    public sealed class FeedbackContent
    {
        public const int MinLength = 10;
        public const int MaxLength = 5000;

        public string Value { get; }

        private FeedbackContent(string value) => Value = value;

        public static FeedbackContent Create(string rawContent)
        {
            var trimmed = rawContent?.Trim() ?? string.Empty;

            if (trimmed.Length < MinLength)
                throw new ArgumentException($"Content must be at least {MinLength} characters");

            if (trimmed.Length > MaxLength)
                throw new ArgumentException($"Content cannot exceed {MaxLength} characters");

            return new FeedbackContent(trimmed);
        }

        public override string ToString() => Value;
    }
}
