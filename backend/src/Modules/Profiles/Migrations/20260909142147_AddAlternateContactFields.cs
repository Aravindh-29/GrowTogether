using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CombinedStudies.Profiles.Migrations
{
    /// <inheritdoc />
    public partial class AddAlternateContactFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AlternateEmail",
                schema: "profiles",
                table: "Profiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AlternatePhone",
                schema: "profiles",
                table: "Profiles",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AlternateEmail",
                schema: "profiles",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "AlternatePhone",
                schema: "profiles",
                table: "Profiles");
        }
    }
}
