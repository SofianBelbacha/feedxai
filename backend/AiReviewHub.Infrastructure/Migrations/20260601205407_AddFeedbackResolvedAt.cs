using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiReviewHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFeedbackResolvedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ResolvedAt",
                table: "Feedbacks",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResolvedAt",
                table: "Feedbacks");
        }
    }
}
