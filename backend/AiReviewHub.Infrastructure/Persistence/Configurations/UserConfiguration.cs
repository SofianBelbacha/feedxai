using AiReviewHub.Domain.Entities;
using AiReviewHub.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Infrastructure.Persistence.Configurations
{
    public class UserConfiguration : IEntityTypeConfiguration<User>
    {
        public void Configure(EntityTypeBuilder<User> builder)
        {
            builder.HasKey(u => u.Id);

            builder.Property(u => u.Email)
                .HasConversion(
                    v => v.Value,
                    v => Email.Create(v))
                .HasMaxLength(254)
                .IsRequired();

            builder.HasIndex(u => u.Email)
                .IsUnique();

            // PasswordHash devient nullable
            builder.Property(u => u.PasswordHash)
                .HasConversion(
                    v => v == null ? null : v.Value,
                    v => v == null ? null : PasswordHash.Create(v))
                .HasMaxLength(60)
                .IsRequired(false); // ← nullable


            builder.Property(u => u.FirstName)
                .HasMaxLength(100)
                .IsRequired();

            builder.Property(u => u.LastName)
                .HasMaxLength(100)
                .IsRequired();

            // UserConfiguration.cs
            builder.Property(u => u.GoogleId)
                .HasMaxLength(100);

            builder.HasIndex(u => u.GoogleId)
                .IsUnique()
                .HasFilter("\"GoogleId\" IS NOT NULL"); // index partiel PostgreSQL — null exclus

            builder.Property(u => u.Plan)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();

            builder.Property(u => u.CreatedAt)
                .IsRequired();

            builder.Property(u => u.StripeCustomerId)
                .HasMaxLength(100);

            builder.HasIndex(u => u.StripeCustomerId)
                .IsUnique()
                .HasFilter("\"StripeCustomerId\" IS NOT NULL");

            builder.HasMany(u => u.Projects)
                .WithOne(p => p.User)
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Navigation(u => u.RefreshTokens)
                .UsePropertyAccessMode(PropertyAccessMode.Field);

        }
    }
}
