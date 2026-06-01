using AiReviewHub.Domain.Entities;
using AiReviewHub.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Infrastructure.Persistence.Configurations
{
    public class FeedbackConfiguration : IEntityTypeConfiguration<Feedback>
    {
        public void Configure(EntityTypeBuilder<Feedback> builder)
        {
            builder.HasKey(f => f.Id);

            builder.Property(f => f.Content)
                .HasConversion(
                    v => v.Value,
                    v => FeedbackContent.Create(v))
                .HasMaxLength(FeedbackContent.MaxLength)
                .IsRequired();

            builder.Property(f => f.Category)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();

            builder.Property(f => f.Priority)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();

            builder.Property(f => f.Status)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();

            builder.Property(f => f.AiSummary)
                .HasColumnType("text");

            builder.Property(f => f.AiAnalysisStatus)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();

            builder.Property(f => f.AiAnalysisError)
                .HasMaxLength(500);

            builder.Property(f => f.CreatedAt)
                .IsRequired();

            builder.Property(x => x.UpdatedAt)
                .IsRequired(false);

            builder.Property(x => x.ResolvedAt)
                .IsRequired(false);

            builder.Property(f => f.PriorityScore)
                .IsRequired(false);

            builder.Property(f => f.Sentiment)
                .HasMaxLength(20)
                .IsRequired(false);

            builder.Property(f => f.SentimentScore)
                .IsRequired(false);

            builder.Property(f => f.KeyTopics)
                .HasMaxLength(200) // JSON array
                .IsRequired(false);

            builder.Property(f => f.ActionRequired)
                .IsRequired(false);

            builder.Property(f => f.Urgency)
                .HasMaxLength(20)
                .IsRequired(false);

            builder.HasIndex(f => f.ProjectId);
            builder.HasIndex(f => f.Status);
        }
    }
}
