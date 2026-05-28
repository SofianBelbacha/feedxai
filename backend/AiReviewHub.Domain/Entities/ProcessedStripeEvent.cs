using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Domain.Entities
{
    public class ProcessedStripeEvent
    {
        public string StripeEventId { get; private set; } = string.Empty;
        public string EventType { get; private set; } = string.Empty;
        public DateTime ProcessedAt { get; private set; }

        private ProcessedStripeEvent() { }

        public static ProcessedStripeEvent Create(string stripeEventId, string eventType, DateTime processedAt) =>
            new()
            {
                StripeEventId = stripeEventId,
                EventType = eventType,
                ProcessedAt = processedAt
            };
    }
}
