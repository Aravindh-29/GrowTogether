using CombinedStudies.Profiles.Data;
using CombinedStudies.Profiles.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CombinedStudies.Profiles;

public static class ProfilesModule
{
    public static IServiceCollection AddProfilesModule(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<ProfilesDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Default")));

        services.AddScoped<IProfileService, ProfileService>();

        return services;
    }

    public static async Task MigrateProfilesAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ProfilesDbContext>();
        await db.Database.MigrateAsync();
    }
}
