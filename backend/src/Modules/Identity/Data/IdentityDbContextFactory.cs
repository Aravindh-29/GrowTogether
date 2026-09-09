using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CombinedStudies.Identity.Data;

// Used only by EF Core CLI (dotnet ef migrations add/update) — not registered in DI.
public class IdentityDbContextFactory : IDesignTimeDbContextFactory<IdentityDbContext>
{
    public IdentityDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<IdentityDbContext>()
            .UseNpgsql("Host=localhost;Port=5433;Database=combinedstudies;Username=cs_user;Password=cs_dev_password")
            .Options;
        return new IdentityDbContext(options);
    }
}
