using CombinedStudies.Identity.Data;
using CombinedStudies.Identity.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CombinedStudies.Identity;

public static class IdentityModule
{
    public static IServiceCollection AddIdentityModule(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<IdentityDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Default")));

        services.AddScoped<IAuthService, AuthService>();

        return services;
    }

    public static async Task MigrateIdentityAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        await db.Database.MigrateAsync();
    }
}
