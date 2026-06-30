using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Infrastructure.Jobs;
using AiReviewHub.Infrastructure.Persistence;
using AiReviewHub.Infrastructure.Services;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using OpenAI;

namespace AiReviewHub.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureDI(this IServiceCollection services, IConfiguration configuration)
    {

        // ─── Base de données ──────────────────────────────────
        // Render injecte DATABASE_URL au format URI (postgres://user:pass@host:port/db),
        // pas au format clé-valeur attendu par Npgsql — on convertit si besoin.
        var connectionString = ResolveConnectionString(configuration);

        // ─── Base de données ──────────────────────────────────
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(connectionString));

        services.AddScoped<IAppDbContext>(sp =>
            sp.GetRequiredService<AppDbContext>());

        // ─── Services domaine ─────────────────────────────────
        services.AddSingleton<IDateTimeProvider, DateTimeProvider>();
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IGoogleTokenValidator, GoogleTokenValidator>();
        services.AddScoped<IFeedbackAnalysisQueue, HangfireFeedbackAnalysisQueue>();
        services.AddScoped<IStripeService, StripeService>();
        services.AddScoped<IPlanLimitsService, PlanLimitsService>();
        services.AddScoped<IWidgetProtectionService, WidgetProtectionService>();

        // ─── OpenAI — singletons (réutilise les sockets HTTP) ─
        var openAiKey = configuration["OpenAI:ApiKey"]
            ?? throw new InvalidOperationException("OpenAI:ApiKey is not configured");
        var openAiModel = configuration["OpenAI:Model"] ?? "gpt-4.1-mini";

        services.AddSingleton(new OpenAIClient(openAiKey));
        services.AddSingleton(sp =>
            sp.GetRequiredService<OpenAIClient>().GetChatClient(openAiModel));

        services.AddScoped<IAiAnalysisService, AiAnalysisService>();

        // ─── Quota IA ─────────────────────────────────────────
        services.AddScoped<IAiQuotaService, AiQuotaService>();

        // ─── Hangfire ─────────────────────────────────────────
        services.AddHangfire(config => config
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UsePostgreSqlStorage(options =>
            {
                options.UseNpgsqlConnection(connectionString);
            }));

        services.AddHangfireServer(options =>
        {
            options.WorkerCount = 4;
            options.Queues = ["critical", "default", "free"];
        });

        // ─── Jobs ─────────────────────────────────────────────
        services.AddScoped<FeedbackAnalysisJob>();
        services.AddScoped<RefreshTokenCleanupJob>();

        return services;
    }

    private static string ResolveConnectionString(IConfiguration configuration)
    {
        // 1. Format .NET classique (local, ou variable d'env ConnectionStrings__DefaultConnection)
        var configured = configuration.GetConnectionString("DefaultConnection");
        if (!string.IsNullOrWhiteSpace(configured))
            return configured;

        // 2. Format URI fourni par Render (DATABASE_URL)
        var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
        if (string.IsNullOrWhiteSpace(databaseUrl))
            throw new InvalidOperationException(
                "No database connection string configured (neither ConnectionStrings:DefaultConnection nor DATABASE_URL).");

        var uri = new Uri(databaseUrl);
        var userInfo = uri.UserInfo.Split(':', 2);

        return new Npgsql.NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = userInfo[0],
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty,
            SslMode = Npgsql.SslMode.Require
        }.ToString();
    }
}