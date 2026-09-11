using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CombinedStudies.Posts.Migrations
{
    /// <inheritdoc />
    public partial class AddPostImageUrl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                schema: "posts",
                table: "Posts",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageUrl",
                schema: "posts",
                table: "Posts");
        }
    }
}
