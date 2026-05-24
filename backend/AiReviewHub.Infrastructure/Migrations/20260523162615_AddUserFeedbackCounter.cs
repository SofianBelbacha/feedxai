using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiReviewHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserFeedbackCounter : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FeedbacksThisMonth",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "QuotaResetDate",
                table: "Users",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(2024, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FeedbacksThisMonth",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "QuotaResetDate",
                table: "Users");
        }
    }
}
