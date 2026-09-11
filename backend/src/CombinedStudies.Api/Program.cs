using System.Text;
using System.Text.Json.Serialization;
using CombinedStudies.Api.Endpoints;
using CombinedStudies.Api.Hubs;
using CombinedStudies.Api.Services;
using Minio;
using CombinedStudies.Groups.Services;
using CombinedStudies.Chat;
using CombinedStudies.Connections;
using CombinedStudies.Groups;
using CombinedStudies.Identity;
using CombinedStudies.Posts;
using CombinedStudies.Profiles;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(opts =>
    opts.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                    { Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddHealthChecks();

builder.Services.AddResponseCompression(opts =>
{
    opts.EnableForHttps = true;
    opts.Providers.Add<BrotliCompressionProvider>();
    opts.Providers.Add<GzipCompressionProvider>();
    opts.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(
        ["application/json", "text/plain", "application/javascript", "text/css"]);
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = System.IO.Compression.CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = System.IO.Compression.CompressionLevel.SmallestSize);

builder.Services.AddCors(opts =>
    opts.AddDefaultPolicy(p => p
        .SetIsOriginAllowed(origin =>
        {
            var uri = new Uri(origin);
            return uri.Host is "localhost" or "127.0.0.1" || uri.Host.StartsWith("192.168.");
        })
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));

var jwtSecret = builder.Configuration["Jwt:Secret"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"],
            ValidAudience            = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
        // Allow JWT in query string for SignalR WebSocket connections
        opts.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && ctx.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// SignalR
builder.Services.AddSignalR();

// Modules
builder.Services.AddIdentityModule(builder.Configuration);
builder.Services.AddProfilesModule(builder.Configuration);
builder.Services.AddConnectionsModule(builder.Configuration);
builder.Services.AddChatModule(builder.Configuration);
builder.Services.AddGroupsModule(builder.Configuration);
builder.Services.AddScoped<IGroupNotifier, SignalRGroupNotifier>();
builder.Services.AddPostsModule(builder.Configuration);

// MinIO storage
var minioCfg = builder.Configuration.GetSection("MinIO");
builder.Services.AddMinio(opts => opts
    .WithEndpoint(minioCfg["Endpoint"] ?? "localhost:9000")
    .WithCredentials(minioCfg["AccessKey"] ?? "minioadmin", minioCfg["SecretKey"] ?? "minioadmin")
    .WithSSL(false));
builder.Services.AddScoped<IStorageService, MinioStorageService>();

var app = builder.Build();

await app.Services.MigrateIdentityAsync();
await app.Services.MigrateProfilesAsync();
await app.Services.MigrateConnectionsAsync();
await app.Services.MigrateChatAsync();
await app.Services.MigrateGroupsAsync();
await app.Services.MigratePostsAsync();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseResponseCompression();
app.UseCors();
app.UseDefaultFiles();
// Cache content-hashed static assets (JS/CSS) for 1 year; index.html stays no-cache
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var path = ctx.File.Name;
        if (path.EndsWith(".html"))
            ctx.Context.Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
        else if (path.EndsWith(".js") || path.EndsWith(".css") || path.EndsWith(".woff2"))
            ctx.Context.Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
    }
});
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapGet("/api", () => new { name = "CombinedStudies API", version = "0.1.0", status = "ok" })
   .WithName("Root").WithOpenApi();

app.MapIdentityEndpoints();
app.MapProfileEndpoints();
app.MapConnectionEndpoints();
app.MapChatEndpoints();
app.MapGroupEndpoints();
app.MapNotificationEndpoints();
app.MapPostEndpoints();

// Call status — lightweight check so UI can show "Join" vs "Start call"
app.MapGet("/api/groups/{groupId}/call-active", (string groupId) =>
    Results.Ok(new { active = CombinedStudies.Api.Hubs.ChatHub.IsGroupCallActive(groupId) })
).RequireAuthorization();

// SignalR hub
app.MapHub<ChatHub>("/hubs/chat");

// SPA fallback — must be last
app.MapFallbackToFile("index.html");

app.Run();

public partial class Program { }
