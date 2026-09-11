using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CombinedStudies.Groups.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupMessageIsSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsSystem",
                schema: "groups",
                table: "Messages",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsSystem",
                schema: "groups",
                table: "Messages");
        }
    }
}
