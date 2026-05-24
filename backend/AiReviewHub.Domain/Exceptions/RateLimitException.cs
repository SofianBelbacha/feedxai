using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Domain.Exceptions
{
    public class RateLimitException : Exception
    {
        public RateLimitException(string message) : base(message) { }
    }
}
