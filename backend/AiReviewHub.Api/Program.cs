using AiReviewHub.Api;
using AiReviewHub.Api.Middleware;
using AiReviewHub.Infrastructure.Jobs;
using AiReviewHub.Infrastructure.Persistence;
using Hangfire;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Threading.RateLimiting;


var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Ajout du service
builder.Services.AddHealthChecks();

builder.Services.AddAppDI(builder.Configuration);

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)
            ),
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy("Development", policy =>
    {
        policy
            .WithOrigins("http://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials(); // ← indispensable pour les cookies
    });

    options.AddPolicy("Production", policy =>
    {
        policy
            .WithOrigins("https://ton-domaine.com")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddRateLimiter(options =>
{
    // Limite par IP sur l'endpoint widget
    options.AddPolicy("widget_ip", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10, // 10 soumissions
                Window = TimeSpan.FromHours(1), // par heure par IP
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0 // pas de file d'attente — rejet immédiat
            }));

    // Réponse sur dépassement — 429 silencieux (ne pas informer le bot)
    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            type = "RateLimitExceeded",
            error = "Too many requests. Please try again later."
        }, ct);
    };
});


builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    // Policy existante pour l'app Angular
    options.AddPolicy("Angular", policy =>
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());

    // Policy pour le widget — accepte TOUTES les origines
    options.AddPolicy("Widget", policy =>
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .WithMethods("POST", "OPTIONS"));
});

var app = builder.Build();

// Appliquer les migrations automatiquement au démarrage
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

app.UseCors(app.Environment.IsDevelopment() ? "Development" : "Production");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization = [] // pas d'auth en dev
    });
}

app.UseRateLimiter();

//app.UseHttpsRedirection();

app.UseMiddleware<ExceptionMiddleware>();


// Planifie le job toutes les nuits à minuit
RecurringJob.AddOrUpdate<RefreshTokenCleanupJob>(
    "cleanup-refresh-tokens",
    job => job.CleanupExpiredTokens(),
    Cron.Daily);

// Dans le pipeline
app.UseCors("Angular");

app.UseAuthentication();

app.UseAuthorization();

// Mapping de l'endpoint
app.MapHealthChecks("/health");

app.MapControllers();

app.Run();
