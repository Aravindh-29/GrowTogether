using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CombinedStudies.Posts.Migrations
{
    /// <inheritdoc />
    public partial class AddImageUrlsReactionsSaves : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<List<string>>(
                name: "ImageUrls",
                schema: "posts",
                table: "Posts",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'[]'::jsonb");

            migrationBuilder.Sql(@"UPDATE posts.""Posts"" SET ""ImageUrls"" = CASE WHEN ""ImageUrl"" IS NOT NULL THEN json_build_array(""ImageUrl"")::jsonb ELSE '[]'::jsonb END");
            migrationBuilder.DropColumn(
                name: "ImageUrl",
                schema: "posts",
                table: "Posts");

            migrationBuilder.CreateTable(
                name: "PostReactions",
                schema: "posts",
                columns: table => new
                {
                    PostId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Type = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PostReactions", x => new { x.PostId, x.UserId });
                    table.ForeignKey(
                        name: "FK_PostReactions_Posts_PostId",
                        column: x => x.PostId,
                        principalSchema: "posts",
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PostSaves",
                schema: "posts",
                columns: table => new
                {
                    PostId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SavedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PostSaves", x => new { x.PostId, x.UserId });
                    table.ForeignKey(
                        name: "FK_PostSaves_Posts_PostId",
                        column: x => x.PostId,
                        principalSchema: "posts",
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PostReactions",
                schema: "posts");

            migrationBuilder.DropTable(
                name: "PostSaves",
                schema: "posts");

            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                schema: "posts",
                table: "Posts",
                type: "text",
                nullable: true);

            migrationBuilder.Sql(@"UPDATE posts.""Posts"" SET ""ImageUrl"" = ""ImageUrls""->>0 WHERE jsonb_array_length(""ImageUrls"") > 0");

            migrationBuilder.DropColumn(
                name: "ImageUrls",
                schema: "posts",
                table: "Posts");
        }
    }
}
