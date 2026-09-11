using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CombinedStudies.Groups.Data;

public class GroupsDbContextFactory : IDesignTimeDbContextFactory<GroupsDbContext>
{
    public GroupsDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<GroupsDbContext>()
            .UseNpgsql("Host=localhost;Port=5433;Database=combinedstudies;Username=cs_user;Password=cs_dev_password")
            .Options;
        return new GroupsDbContext(options);
    }
}
