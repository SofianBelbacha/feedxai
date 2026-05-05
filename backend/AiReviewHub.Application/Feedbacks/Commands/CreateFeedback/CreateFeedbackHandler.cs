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
    private readonly IBackgroundJobClient _backgroundJobs;
    private readonly ILogger<CreateFeedbackHandler> _logger;
    private readonly IFeedbackAnalysisQueue _analysisQueue; // ← interface Application


    public CreateFeedbackHandler(
        IAppDbContext context,
        IDateTimeProvider dateTimeProvider,
        ICurrentUserService currentUser,
        IMapper mapper,
        IBackgroundJobClient backgroundJobs,
        ILogger<CreateFeedbackHandler> logger,
        IFeedbackAnalysisQueue analysisQueue)
    {
        _context = context;
        _dateTimeProvider = dateTimeProvider;
        _currentUser = currentUser;
        _mapper = mapper;
        _backgroundJobs = backgroundJobs;
        _logger = logger;
        _analysisQueue = analysisQueue;
    }

    public async Task<CreateFeedbackResult> Handle(
        CreateFeedbackCommand request,
        CancellationToken cancellationToken)
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