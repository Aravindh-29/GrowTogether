using System.Collections.Concurrent;
using CombinedStudies.Api.Services;
using Microsoft.AspNetCore.Hosting;
using CombinedStudies.Identity.Data;
using CombinedStudies.Profiles.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Tests;

/// <summary>
/// Shared test fixture that wraps WebApplicationFactory and auto-cleans every
/// identity user + profile created during the test run so the dev DB stays tidy.
/// </summary>
public class TestFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    // All test emails registered during this session
    private readonly ConcurrentBag<string> _registeredEmails = [];

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Replace real MinIO storage with in-memory fake so tests don't need a live MinIO
            var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IStorageService));
            if (descriptor is not null) services.Remove(descriptor);
            services.AddScoped<IStorageService, FakeStorageService>();
        });
    }

    /// <summary>Call this whenever a test registers a user so the fixture can track it.</summary>
    public void TrackEmail(string email) => _registeredEmails.Add(email);

    public Task InitializeAsync() => Task.CompletedTask;

    public new async Task DisposeAsync()
    {
        if (_registeredEmails.IsEmpty)
        {
            await base.DisposeAsync();
            return;
        }

        var emails = _registeredEmails.ToArray();

        using var scope = Services.CreateScope();
        var sp = scope.ServiceProvider;

        // Delete test profiles
        var profilesDb = sp.GetRequiredService<ProfilesDbContext>();
        var testProfiles = await profilesDb.Profiles
            .Where(p => emails.Contains(p.Email))
            .ToListAsync();
        profilesDb.Profiles.RemoveRange(testProfiles);
        await profilesDb.SaveChangesAsync();

        // Delete test identity users
        var identityDb = sp.GetRequiredService<IdentityDbContext>();
        var testUsers = await identityDb.Users
            .Where(u => emails.Contains(u.Email))
            .ToListAsync();
        identityDb.Users.RemoveRange(testUsers);
        await identityDb.SaveChangesAsync();

        await base.DisposeAsync();
    }
}
