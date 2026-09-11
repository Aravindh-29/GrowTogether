using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CombinedStudies.Profiles.Migrations
{
    /// <inheritdoc />
    public partial class AddSubjectsCanTeach : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string[]>(
                name: "SubjectsCanTeach",
                schema: "profiles",
                table: "Profiles",
                type: "text[]",
                nullable: false,
                defaultValue: new string[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SubjectsCanTeach",
                schema: "profiles",
                table: "Profiles");
        }
    }
}
