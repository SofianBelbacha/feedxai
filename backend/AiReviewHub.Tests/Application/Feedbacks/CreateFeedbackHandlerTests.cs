using AiReviewHub.Application.Abstractions;
using AiReviewHub.Application.Feedbacks.Commands.CreateFeedback;
using AiReviewHub.Domain.Entities;
using AiReviewHub.Domain.Exceptions;
using AiReviewHub.Infrastructure.Persistence;
using AiReviewHub.Tests.Helpers;
using AutoMapper;
using FluentAssertions;
using Hangfire;
using Microsoft.Extensions.Logging;
using Moq;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Tests.Application.Feedbacks
{
    public class CreateFeedbackHandlerTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly FakeDateTimeProvider _clock;
        private readonly FakeCurrentUserService _currentUser;
        private readonly Mock<IMapper> _mapper;
        private readonly CreateFeedbackHandler _handler;
        private readonly Mock<ILogger<CreateFeedbackHandler>> _logger;
        private readonly Mock<IFeedbackAnalysisQueue> _analysisQueue;
        private readonly Mock<IPlanLimitsService> _planLimits;


        public CreateFeedbackHandlerTests()
        {
            _context = TestDbContextFactory.Create();
            _clock = new FakeDateTimeProvider();
            _currentUser = new FakeCurrentUserService();
            _mapper = new Mock<IMapper>();
            _logger = new Mock<ILogger<CreateFeedbackHandler>>();
            _analysisQueue = new Mock<IFeedbackAnalysisQueue>();
            _planLimits = new Mock<IPlanLimitsService>();

            // Par défaut : quota toujours disponible
            _planLimits
                .Setup(p => p.TryConsumeFeedbackSlotAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new QuotaConsumeResult(IsAllowed: true, Current: 1, Limit: 50));


            _handler = new CreateFeedbackHandler(
                _context,
                _clock,
                _currentUser,
                _mapper.Object,
                _logger.Object,
                _analysisQueue.Object,
                _planLimits.Object);
        }

        [Fact]
        public async Task Handle_WithValidRequest_ShouldCreateFeedback()
        {
            // Arrange
            var user = EntityBuilders.BuildUser();
            var project = Project.Create("Test", "", user.Id, _clock.UtcNow);
            _context.Users.Add(user);
            _context.Projects.Add(project);
            await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

            _currentUser.UserId = user.Id;

            var expectedResult = new CreateFeedbackResult(
                Guid.NewGuid(), "Contenu test", "Uncategorized", "Normal", "Todo",
                _clock.UtcNow);

            _mapper.Setup(m => m.Map<CreateFeedbackResult>(It.IsAny<Feedback>()))
                   .Returns(expectedResult);

            var command = new CreateFeedbackCommand(
                "Contenu du feedback avec assez de texte",
                project.Id);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();

            var feedbackInDb = _context.Feedbacks.Single();
            feedbackInDb.ProjectId.Should().Be(project.Id);
            feedbackInDb.Content.Value.Should().Be("Contenu du feedback avec assez de texte");
        }

        [Fact]
        public async Task Handle_WhenQuotaExceeded_ShouldThrowQuotaExceededException()
        {
            // Arrange
            var user = EntityBuilders.BuildUser();
            var project = Project.Create("Test", "", user.Id, _clock.UtcNow);
            _context.Users.Add(user);
            _context.Projects.Add(project);
            await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

            _currentUser.UserId = user.Id;

            // Override du setup par défaut pour CE test précis
            _planLimits
                .Setup(p => p.TryConsumeFeedbackSlotAsync(user.Id, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new QuotaConsumeResult(IsAllowed: false, Current: 50, Limit: 50));

            var command = new CreateFeedbackCommand(
                "Contenu du feedback avec assez de texte",
                project.Id);

            // Act
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<QuotaExceededException>();

            // Vérifie qu'aucun feedback n'a été créé malgré l'appel
            _context.Feedbacks.Should().BeEmpty();

            // Vérifie qu'aucun job IA n'a été enqueued (le quota a bloqué avant)
            _analysisQueue.Verify(
                q => q.Enqueue(It.IsAny<Guid>(), It.IsAny<string>()),
                Times.Never);
        }

        [Fact]
        public async Task Handle_WithValidRequest_ShouldEnqueueAiJob()
        {
            // Arrange
            var user = EntityBuilders.BuildUser();
            var project = Project.Create("Test", "", user.Id, _clock.UtcNow);
            _context.Users.Add(user);
            _context.Projects.Add(project);
            await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

            _currentUser.UserId = user.Id;

            _mapper.Setup(m => m.Map<CreateFeedbackResult>(It.IsAny<Feedback>()))
                   .Returns(new CreateFeedbackResult(
                       Guid.NewGuid(), "", "", "", "", _clock.UtcNow));

            var command = new CreateFeedbackCommand(
                "Contenu du feedback avec assez de texte",
                project.Id);

            // Act
            await _handler.Handle(command, CancellationToken.None);

            // Assert — vérifie que Hangfire a été appelé
            _analysisQueue.Verify(
                q => q.Enqueue(It.IsAny<Guid>(), user.Plan.ToString()),
                Times.Once);
        }

        [Fact]
        public async Task Handle_WithInactiveProject_ShouldThrowNotFoundException()
        {
            // Arrange
            var user = EntityBuilders.BuildUser();
            var project = Project.Create("Test", "", user.Id, _clock.UtcNow);
            project.SoftDelete(_clock); // projet inactif
            _context.Users.Add(user);
            _context.Projects.Add(project);
            await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

            _currentUser.UserId = user.Id;

            var command = new CreateFeedbackCommand(
                "Contenu du feedback avec assez de texte",
                project.Id);

            // Act
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>()
                     .WithMessage("*inactive*");
        }

        [Fact]
        public async Task Handle_WithProjectOfOtherUser_ShouldThrowNotFoundException()
        {
            // Arrange
            var otherUser = EntityBuilders.BuildUser("other@example.com");
            var project = Project.Create("Test", "", otherUser.Id, _clock.UtcNow);
            _context.Users.Add(otherUser);
            _context.Projects.Add(project);
            await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

            // currentUser est différent du propriétaire du projet
            _currentUser.UserId = Guid.NewGuid();

            var command = new CreateFeedbackCommand(
                "Contenu du feedback avec assez de texte",
                project.Id);

            // Act
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_WithNonExistentProject_ShouldThrowNotFoundException()
        {
            // Arrange
            _currentUser.UserId = Guid.NewGuid();

            var command = new CreateFeedbackCommand(
                "Contenu du feedback avec assez de texte",
                Guid.NewGuid()); // projet inexistant

            // Act
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
        }

        public void Dispose() => _context.Dispose();
    }
}
