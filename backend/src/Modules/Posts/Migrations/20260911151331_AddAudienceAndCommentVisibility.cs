using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CombinedStudies.Posts.Migrations
{
    /// <inheritdoc />
    public partial class AddAudienceAndCommentVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Audience",
                schema: "posts",
                table: "Posts",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "anyone");

            migrationBuilder.AddColumn<string>(
                name: "CommentVisibility",
                schema: "posts",
                table: "Posts",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "anyone");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Audience",
                schema: "posts",
                table: "Posts");

            migrationBuilder.DropColumn(
                name: "CommentVisibility",
                schema: "posts",
                table: "Posts");
        }
    }
}
