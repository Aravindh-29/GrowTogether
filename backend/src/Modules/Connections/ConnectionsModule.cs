using CombinedStudies.Connections.Data;
using CombinedStudies.Connections.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CombinedStudies.Connections;

public static class ConnectionsModule
{
    public static IServiceCollection AddConnectionsModule(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<ConnectionsDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Default")));
        services.AddScoped<IConnectionService, ConnectionService>();
        return services;
    }

    public static async Task MigrateConnectionsAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ConnectionsDbContext>();
        await db.Database.MigrateAsync();
    }
}
