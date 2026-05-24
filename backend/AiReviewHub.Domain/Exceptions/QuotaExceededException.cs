using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Domain.Exceptions
{
    public class QuotaExceededException : Exception
    {
        public int Current { get; }
        public int Limit { get; }
        public DateTime ResetDate { get; }

        public QuotaExceededException(int current, int limit, DateTime resetDate)
            : base($"Quota dépassé : {current}/{limit}. Réinitialisation le {resetDate:dd/MM/yyyy}.")
        {
            Current = current;
            Limit = limit;
            ResetDate = resetDate;
        }
    }
}
