using CombinedStudies.Posts.Data;
using CombinedStudies.Posts.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace CombinedStudies.Posts;

public static class PostsModule
{
    public static IServiceCollection AddPostsModule(this IServiceCollection services, IConfiguration config)
    {
        // EnableDynamicJson required for List<string> jsonb columns (Npgsql 8+)
        var dataSource = new NpgsqlDataSourceBuilder(config.GetConnectionString("Default"))
            .EnableDynamicJson()
            .Build();

        services.AddDbContext<PostsDbContext>(opts => opts.UseNpgsql(dataSource));
        services.AddScoped<IPostService, PostService>();
        return services;
    }

    public static async Task MigratePostsAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PostsDbContext>();
        await db.Database.MigrateAsync();
    }
}
