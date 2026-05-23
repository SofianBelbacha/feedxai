using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Infrastructure.Persistence
{
    public class AppDbContext : DbContext, IAppDbContext
    {

        public DbSet<User> Users => Set<User>();
        public DbSet<Project> Projects => Set<Project>();
        public DbSet<Feedback> Feedbacks => Set<Feedback>();
        public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
        public DbSet<AiUsageCounter> AiUsageCounters => Set<AiUsageCounter>();

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
            => base.SaveChangesAsync(cancellationToken);

        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        // Ajout des DbSet

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.ApplyConfigurationsFromAssembly(
                typeof(AppDbContext).Assembly
            );
            base.OnModelCreating(modelBuilder);
        }

    }
}
