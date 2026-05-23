using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Domain.Entities
{
    public class AiUsageCounter
    {
        public Guid UserId { get; private set; }
        public DateOnly Date { get; private set; }
        public int Count { get; private set; }

        private AiUsageCounter() { }

        public static AiUsageCounter Create(Guid userId, DateOnly date) =>
            new() { UserId = userId, Date = date, Count = 0 };
    }
}
