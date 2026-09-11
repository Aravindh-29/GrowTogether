using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CombinedStudies.Profiles.Data;

public class ProfilesDbContextFactory : IDesignTimeDbContextFactory<ProfilesDbContext>
{
    public ProfilesDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<ProfilesDbContext>()
            .UseNpgsql("Host=localhost;Port=5433;Database=combinedstudies;Username=cs_user;Password=cs_dev_password")
            .Options;
        return new ProfilesDbContext(options);
    }
}
