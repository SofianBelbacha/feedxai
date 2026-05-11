using AiReviewHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Infrastructure.Persistence.Configurations
{
    public class ProjectConfiguration : IEntityTypeConfiguration<Project>
    {
        public void Configure(EntityTypeBuilder<Project> builder)
        {
            builder.HasKey(p => p.Id);

            builder.Property(p => p.Name)
                .HasMaxLength(Project.MaxNameLength)
                .IsRequired();

            builder.Property(p => p.Description)
                .HasMaxLength(Project.MaxDescriptionLength);

            builder.Property(p => p.PublicToken)
                .HasMaxLength(32)
                .IsRequired();

            builder.HasIndex(p => p.PublicToken)
                .IsUnique();

            builder.Property(p => p.IsActive)
                .IsRequired();

            builder.Property(p => p.CreatedAt)
                .IsRequired();

            builder.Property(p => p.WidgetConfigJson)
                .HasColumnType("jsonb"); // PostgreSQL JSON natif

            builder.HasMany(p => p.Feedbacks)
                .WithOne(f => f.Project)
                .HasForeignKey(f => f.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(p => p.UserId);
        }
    }
}
