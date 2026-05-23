using AiReviewHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Infrastructure.Persistence.Configurations
{
    public class AiUsageCounterConfiguration : IEntityTypeConfiguration<AiUsageCounter>
    {
        public void Configure(EntityTypeBuilder<AiUsageCounter> builder)
        {
            builder.ToTable("ai_usage_counters");

            // Clé composite : un compteur par user par jour
            builder.HasKey(x => new { x.UserId, x.Date });

            builder.Property(x => x.UserId).IsRequired();
            builder.Property(x => x.Date).IsRequired();
            builder.Property(x => x.Count).IsRequired().HasDefaultValue(0);
        }
    }
}
