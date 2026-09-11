using CombinedStudies.Chat.Data;
using CombinedStudies.Chat.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CombinedStudies.Chat;

public static class ChatModule
{
    public static IServiceCollection AddChatModule(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<ChatDbContext>(opts =>
            opts.UseNpgsql(config.GetConnectionString("Default")));
        services.AddScoped<IChatService, ChatService>();
        return services;
    }

    public static async Task MigrateChatAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ChatDbContext>();
        await db.Database.MigrateAsync();
    }
}
