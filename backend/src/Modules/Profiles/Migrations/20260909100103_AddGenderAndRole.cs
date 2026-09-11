using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CombinedStudies.Profiles.Migrations
{
    /// <inheritdoc />
    public partial class AddGenderAndRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "ProfilePictureUrl",
                schema: "profiles",
                table: "Profiles",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000,
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                schema: "profiles",
                table: "Profiles",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Role",
                schema: "profiles",
                table: "Profiles",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Gender",
                schema: "profiles",
                table: "Profiles");

            migrationBuilder.DropColumn(
                name: "Role",
                schema: "profiles",
                table: "Profiles");

            migrationBuilder.AlterColumn<string>(
                name: "ProfilePictureUrl",
                schema: "profiles",
                table: "Profiles",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);
        }
    }
}
