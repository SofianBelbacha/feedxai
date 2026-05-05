using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Abstractions
{
    public interface IFeedbackAnalysisQueue
    {
        void Enqueue(Guid feedbackId, string plan);
    }
}
