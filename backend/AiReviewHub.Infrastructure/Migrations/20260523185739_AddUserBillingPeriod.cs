using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiReviewHub.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserBillingPeriod : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "BillingPeriodEnd",
                table: "Users",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "NOW() + INTERVAL '1 month'");

            migrationBuilder.AddColumn<DateTime>(
                name: "BillingPeriodStart",
                table: "Users",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "NOW()");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BillingPeriodEnd",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "BillingPeriodStart",
                table: "Users");
        }
    }
}
