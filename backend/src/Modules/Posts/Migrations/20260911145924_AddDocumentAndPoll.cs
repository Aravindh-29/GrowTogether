using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CombinedStudies.Posts.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentAndPoll : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DocumentName",
                schema: "posts",
                table: "Posts",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DocumentUrl",
                schema: "posts",
                table: "Posts",
                type: "text",
                nullable: true);

            // Set defaultValueSql so existing rows get an empty array, not NULL
            migrationBuilder.AddColumn<List<string>>(
                name: "PollOptions",
                schema: "posts",
                table: "Posts",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'[]'::jsonb");

            migrationBuilder.AddColumn<string>(
                name: "PollQuestion",
                schema: "posts",
                table: "Posts",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ScheduledAt",
                schema: "posts",
                table: "Posts",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DocumentName",
                schema: "posts",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "DocumentUrl",
                schema: "posts",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "PollOptions",
                schema: "posts",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "PollQuestion",
                schema: "posts",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "ScheduledAt",
                schema: "posts",
                table: "Posts");
        }
    }
}
