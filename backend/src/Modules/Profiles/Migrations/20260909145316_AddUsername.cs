using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CombinedStudies.Profiles.Migrations
{
    /// <inheritdoc />
    public partial class AddUsername : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Username",
                schema: "profiles",
                table: "Profiles",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Profiles_Username",
                schema: "profiles",
                table: "Profiles",
                column: "Username",
                unique: true,
                filter: "\"Username\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Profiles_Username",
                schema: "profiles",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "Username",
                schema: "profiles",
                table: "Profiles");
        }
    }
}
