using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CombinedStudies.Posts.Data;

public class PostsDbContextFactory : IDesignTimeDbContextFactory<PostsDbContext>
{
    public PostsDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<PostsDbContext>()
            .UseNpgsql("Host=localhost;Port=5433;Database=combinedstudies;Username=cs_user;Password=cs_dev_password")
            .Options;
        return new PostsDbContext(options);
    }
}
