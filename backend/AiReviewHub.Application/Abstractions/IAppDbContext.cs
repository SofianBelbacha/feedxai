using AiReviewHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Abstractions
{
    public interface IAppDbContext
    {
        DbSet<User> Users { get; }
        DbSet<Project> Projects { get; }
        DbSet<Feedback> Feedbacks { get; }
        DbSet<RefreshToken> RefreshTokens { get; }
        DbSet<ProcessedStripeEvent> ProcessedStripeEvents { get; }

        DatabaseFacade Database { get; }

        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}
