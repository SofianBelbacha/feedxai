using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Entities;
using AiReviewHub.Domain.Enums;
using AiReviewHub.Domain.Exceptions;
using AutoMapper;
using Hangfire;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AiReviewHub.Application.Feedbacks.Commands.CreateFeedback;

public class CreateFeedbackHandler : IRequestHandler<CreateFeedbackCommand, CreateFeedbackResult>
{
    private readonly IAppDbContext _context;
    private readonly IDateTimeProvider _dateTimeProvider;
    private readonly ICurrentUserService _currentUser;
    private readonly IMapper _mapper;
    private readonly ILogger<CreateFeedbackHandler> _logger;
    private readonly IFeedbackAnalysisQueue _analysisQueue; // interface Application
    private readonly IPlanLimitsService _planLimits;


    public CreateFeedbackHandler(
        IAppDbContext context,
        IDateTimeProvider dateTimeProvider,
        ICurrentUserService currentUser,
        IMapper mapper,
        ILogger<CreateFeedbackHandler> logger,
        IFeedbackAnalysisQueue analysisQueue,
        IPlanLimitsService planLimits)
    {
        _context = context;
        _dateTimeProvider = dateTimeProvider;
        _currentUser = currentUser;
        _mapper = mapper;
        _logger = logger;
        _analysisQueue = analysisQueue;
        _planLimits = planLimits;
    }

    public async Task<CreateFeedbackResult> Handle(CreateFeedbackCommand request, CancellationToken cancellationToken)
    {
        // Vérifie que le projet existe, est actif et appartient à l'user
        var project = await _context.Projects
            .Include(p => p.User)
            .FirstOrDefaultAsync(p =>
                p.Id == request.ProjectId &&
                p.UserId == _currentUser.UserId &&
                p.IsActive,
                cancellationToken)
            ?? throw new NotFoundException("Project not found or inactive");

        // ── Vérification du quota mensuel ─────────────────────
        var quotaResult = await _planLimits.TryConsumeFeedbackSlotAsync(_currentUser.UserId, cancellationToken);
        if (!quotaResult.IsAllowed)
            throw new QuotaExceededException(
                current: quotaResult.Current,
                limit: quotaResult.Limit,
                resetDate: project.User.QuotaResetDate);


        // Crée le feedback via le Domain
        var feedback = Feedback.Create(
            request.Content,
            request.ProjectId,
            _dateTimeProvider.UtcNow
        );

        _context.Feedbacks.Add(feedback);
        await _context.SaveChangesAsync(cancellationToken);

        // Enqueue le job d'analyse IA selon le plan de l'utilisateur
        _analysisQueue.Enqueue(feedback.Id, project.User.Plan.ToString());

        _logger.LogInformation(
            "[Feedback] Created {FeedbackId} for project {ProjectId} — AI analysis enqueued (plan: {Plan})",
            feedback.Id, request.ProjectId, project.User.Plan);

        return _mapper.Map<CreateFeedbackResult>(feedback);
    }
}