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
    public static IServiceCollection AddInfrastructureDI(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // ─── Base de données ──────────────────────────────────
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString("DefaultConnection")));

        services.AddScoped<IAppDbContext>(sp =>
            sp.GetRequiredService<AppDbContext>());

        // ─── Services domaine ─────────────────────────────────
        services.AddSingleton<IDateTimeProvider, DateTimeProvider>();
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IGoogleTokenValidator, GoogleTokenValidator>();
        services.AddScoped<IFeedbackAnalysisQueue, HangfireFeedbackAnalysisQueue>();

        // ─── OpenAI — singletons (réutilise les sockets HTTP) ─
        var openAiKey = configuration["OpenAI:ApiKey"]
            ?? throw new InvalidOperationException("OpenAI:ApiKey is not configured");
        var openAiModel = configuration["OpenAI:Model"] ?? "gpt-4.1-mini";

        services.AddSingleton(new OpenAIClient(openAiKey));
        services.AddSingleton(sp =>
            sp.GetRequiredService<OpenAIClient>().GetChatClient(openAiModel));

        services.AddScoped<IAiAnalysisService, AiAnalysisService>();

        // ─── Quota IA ─────────────────────────────────────────
        services.AddMemoryCache();
        services.AddScoped<IAiQuotaService, AiQuotaService>();

        // ─── Hangfire ─────────────────────────────────────────
        services.AddHangfire(config => config
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UsePostgreSqlStorage(options =>
            {
                options.UseNpgsqlConnection(
                    configuration.GetConnectionString("DefaultConnection"));
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
}