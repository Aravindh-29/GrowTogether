using CombinedStudies.Groups.Data;
using CombinedStudies.Groups.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CombinedStudies.Groups;

public static class GroupsModule
{
    public static IServiceCollection AddGroupsModule(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<GroupsDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Default")));
        services.AddScoped<IGroupService, GroupService>();
        // IGroupNotifier is registered in the API project (needs IHubContext<ChatHub>)
        return services;
    }

    public static async Task MigrateGroupsAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GroupsDbContext>();
        await db.Database.MigrateAsync();
    }
}
