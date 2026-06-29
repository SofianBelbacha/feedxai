using AiReviewHub.Application.Feedbacks.Commands.UpdateFeedbackStatus;
using AiReviewHub.Domain.Enums;
using AiReviewHub.Domain.Exceptions;
using AiReviewHub.Infrastructure.Persistence;
using AiReviewHub.Tests.Helpers;
using FluentAssertions;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Tests.Application.Feedbacks
{
    public class UpdateFeedbackStatusHandlerTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly FakeDateTimeProvider _clock;
        private readonly FakeCurrentUserService _currentUser;
        private readonly UpdateFeedbackStatusHandler _handler;

        public UpdateFeedbackStatusHandlerTests()
        {
            _context = TestDbContextFactory.Create();
            _clock = new FakeDateTimeProvider();
            _currentUser = new FakeCurrentUserService();

            _handler = new UpdateFeedbackStatusHandler(
                _context,
                _clock,
                _currentUser);
        }

        [Fact]
        public async Task Handle_TodoToInProgress_ShouldUpdateStatus()
        {
            // Arrange
            var user = EntityBuilders.BuildUser();
            var project = EntityBuilders.BuildProject(user.Id);
            var feedback = EntityBuilders.BuildFeedback(project.Id);

            _context.Users.Add(user);
            _context.Projects.Add(project);
            _context.Feedbacks.Add(feedback);
            await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

            _currentUser.UserId = user.Id;

            var command = new UpdateFeedbackStatusCommand(
                feedback.Id, project.Id, FeedbackStatus.InProgress);

            // Act
            await _handler.Handle(command, CancellationToken.None);

            // Assert
            var updated = _context.Feedbacks.Single();
            updated.Status.Should().Be(FeedbackStatus.InProgress);
            updated.UpdatedAt.Should().Be(_clock.UtcNow);
        }

        [Fact]
        public async Task Handle_WithFeedbackOfOtherUser_ShouldThrowNotFoundException()
        {
            // Arrange
            var otherUser = EntityBuilders.BuildUser("other@example.com");
            var project = EntityBuilders.BuildProject(otherUser.Id);
            var feedback = EntityBuilders.BuildFeedback(project.Id);

            _context.Users.Add(otherUser);
            _context.Projects.Add(project);
            _context.Feedbacks.Add(feedback);
            await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

            // currentUser différent
            _currentUser.UserId = Guid.NewGuid();

            var command = new UpdateFeedbackStatusCommand(
                feedback.Id, project.Id, FeedbackStatus.InProgress);

            // Act
            var act = async () => await _handler.Handle(command, CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotFoundException>();
        }

        [Fact]
        public async Task Handle_DoneToTodo_ShouldUpdateStatus()
        {
            var user = EntityBuilders.BuildUser();
            var project = EntityBuilders.BuildProject(user.Id);
            var feedback = EntityBuilders.BuildFeedback(project.Id);

            feedback.UpdateStatus(FeedbackStatus.InProgress, _clock.UtcNow);
            feedback.UpdateStatus(FeedbackStatus.Done, _clock.UtcNow);

            _context.Users.Add(user);
            _context.Projects.Add(project);
            _context.Feedbacks.Add(feedback);

            await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

            _currentUser.UserId = user.Id;

            var command = new UpdateFeedbackStatusCommand(
                feedback.Id,
                project.Id,
                FeedbackStatus.Todo);

            // Act
            await _handler.Handle(command, CancellationToken.None);

            // Assert
            var updated = _context.Feedbacks.Single();

            updated.Status.Should().Be(FeedbackStatus.Todo);
            updated.ResolvedAt.Should().BeNull();
            updated.UpdatedAt.Should().Be(_clock.UtcNow);
        }

        public void Dispose() => _context.Dispose();
    }
}
