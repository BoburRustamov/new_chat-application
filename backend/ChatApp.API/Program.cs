using System.Text.Json;
using System.Text.Json.Serialization;
using ChatApp.API.Extensions;
using ChatApp.API.Hubs;
using ChatApp.API.Middleware;
using ChatApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

// Add services to the container
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerDocumentation();

// Add custom services
builder.Services.AddApplicationServices(builder.Configuration);
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddCorsPolicy(builder.Configuration);

// Add SignalR with JSON string enum converter
builder.Services.AddSignalR(options =>
    {
        options.EnableDetailedErrors = true;
    })
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.PayloadSerializerOptions.PropertyNameCaseInsensitive = true;
    });

var app = builder.Build();

// Ensure database is created and migrated
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    dbContext.Database.EnsureCreated();

    // Add missing columns and tables if they don't exist (for schema updates without migrations)
    try
    {
        await dbContext.Database.ExecuteSqlRawAsync(@"
            DO $$
            BEGIN
                -- User settings columns
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Users' AND column_name = 'PushNotificationsEnabled') THEN
                    ALTER TABLE ""Users"" ADD COLUMN ""PushNotificationsEnabled"" boolean NOT NULL DEFAULT true;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Users' AND column_name = 'EmailNotificationsEnabled') THEN
                    ALTER TABLE ""Users"" ADD COLUMN ""EmailNotificationsEnabled"" boolean NOT NULL DEFAULT false;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Users' AND column_name = 'SoundEnabled') THEN
                    ALTER TABLE ""Users"" ADD COLUMN ""SoundEnabled"" boolean NOT NULL DEFAULT true;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Users' AND column_name = 'ShowOnlineStatus') THEN
                    ALTER TABLE ""Users"" ADD COLUMN ""ShowOnlineStatus"" boolean NOT NULL DEFAULT true;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Users' AND column_name = 'ShowLastSeen') THEN
                    ALTER TABLE ""Users"" ADD COLUMN ""ShowLastSeen"" boolean NOT NULL DEFAULT true;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Users' AND column_name = 'ShowReadReceipts') THEN
                    ALTER TABLE ""Users"" ADD COLUMN ""ShowReadReceipts"" boolean NOT NULL DEFAULT true;
                END IF;

                -- Create DeletedMessages table if it doesn't exist
                IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DeletedMessages') THEN
                    CREATE TABLE ""DeletedMessages"" (
                        ""Id"" uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
                        ""MessageId"" uuid NOT NULL REFERENCES ""Messages""(""Id"") ON DELETE CASCADE,
                        ""UserId"" uuid NOT NULL REFERENCES ""Users""(""Id"") ON DELETE CASCADE,
                        ""DeletedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX ""IX_DeletedMessages_MessageId"" ON ""DeletedMessages""(""MessageId"");
                    CREATE INDEX ""IX_DeletedMessages_UserId"" ON ""DeletedMessages""(""UserId"");
                END IF;
            END $$;
        ");
    }
    catch (Exception ex)
    {
        // Log but don't fail - tables/columns might already exist
        Console.WriteLine($"Schema update note: {ex.Message}");
    }
}

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Custom exception handling middleware
app.UseMiddleware<ExceptionMiddleware>();

app.UseHttpsRedirection();

app.UseCors("CorsPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Map SignalR hub
app.MapHub<ChatHub>("/hubs/chat");

// Health check endpoint for deployment platforms
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

// Enable Swagger in production for API documentation
if (!app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.Run();
