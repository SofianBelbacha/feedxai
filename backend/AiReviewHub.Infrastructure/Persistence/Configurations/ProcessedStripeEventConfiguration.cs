using AiReviewHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Infrastructure.Persistence.Configurations
{
    public class ProcessedStripeEventConfiguration : IEntityTypeConfiguration<ProcessedStripeEvent>
    {
        public void Configure(EntityTypeBuilder<ProcessedStripeEvent> builder)
        {
            builder.ToTable("processed_stripe_events");

            // StripeEventId est la clé naturelle — ex: "evt_1ABC..."
            builder.HasKey(x => x.StripeEventId);

            builder.Property(x => x.StripeEventId)
                .IsRequired()
                .HasMaxLength(255);

            builder.Property(x => x.EventType)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(x => x.ProcessedAt)
                .IsRequired();
        }
    }
}
