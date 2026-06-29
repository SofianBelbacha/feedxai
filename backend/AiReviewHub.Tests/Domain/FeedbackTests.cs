using AiReviewHub.Domain.Entities;
using AiReviewHub.Domain.Enums;
using AiReviewHub.Tests.Helpers;
using FluentAssertions;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Tests.Domain
{
    public class FeedbackTests
    {
        private readonly FakeDateTimeProvider _clock = new();

        [Fact]
        public void Create_WithValidContent_ShouldSetPendingStatus()
        {
            var feedback = Feedback.Create(
                "Feedback avec suffisamment de contenu",
                Guid.NewGuid(),
                _clock.UtcNow);

            feedback.AiAnalysisStatus.Should().Be(AiAnalysisStatus.Pending);
            feedback.Status.Should().Be(FeedbackStatus.Todo);
            feedback.Category.Should().Be(FeedbackCategory.Uncategorized);
            feedback.Priority.Should().Be(FeedbackPriority.Normal);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("Court")]
        public void Create_WithInvalidContent_ShouldThrow(string content)
        {
            var act = () => Feedback.Create(content, Guid.NewGuid(), _clock.UtcNow);
            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void Create_WithEmptyProjectId_ShouldThrow()
        {
            var act = () => Feedback.Create(
                "Contenu valide pour le test",
                Guid.Empty,
                _clock.UtcNow);

            act.Should().Throw<ArgumentException>()
               .WithMessage("*ProjectId*");
        }

        [Fact]
        public void UpdateStatus_TodoToInProgress_ShouldSucceed()
        {
            var feedback = EntityBuilders.BuildFeedback();

            feedback.UpdateStatus(FeedbackStatus.InProgress, _clock.UtcNow);

            feedback.Status.Should().Be(FeedbackStatus.InProgress);
            feedback.UpdatedAt.Should().Be(_clock.UtcNow);
        }

        [Fact]
        public void UpdateStatus_DoneToTodo_ShouldSucceed()
        {
            var feedback = EntityBuilders.BuildFeedback();
            feedback.UpdateStatus(FeedbackStatus.InProgress, _clock.UtcNow);
            feedback.UpdateStatus(FeedbackStatus.Done, _clock.UtcNow);

            feedback.UpdateStatus(FeedbackStatus.Todo, _clock.UtcNow);

            feedback.Status.Should().Be(FeedbackStatus.Todo);
            feedback.UpdatedAt.Should().Be(_clock.UtcNow);
        }

        [Fact]
        public void UpdateStatus_TodoToDone_ShouldSucceed()
        {
            var feedback = EntityBuilders.BuildFeedback(); // statut initial Todo

            feedback.UpdateStatus(FeedbackStatus.Done, _clock.UtcNow);

            feedback.Status.Should().Be(FeedbackStatus.Done);
        }

        [Fact]
        public void UpdateStatus_DoneToTodo_ShouldClearResolvedAt()
        {
            var feedback = EntityBuilders.BuildFeedback();
            feedback.UpdateStatus(FeedbackStatus.InProgress, _clock.UtcNow);
            feedback.UpdateStatus(FeedbackStatus.Done, _clock.UtcNow);
            feedback.ResolvedAt.Should().NotBeNull(); // sanity check

            feedback.UpdateStatus(FeedbackStatus.Todo, _clock.UtcNow);

            feedback.ResolvedAt.Should().BeNull();
        }

        [Theory]
        [InlineData(FeedbackStatus.Todo, FeedbackStatus.InProgress)]
        [InlineData(FeedbackStatus.Todo, FeedbackStatus.Done)]
        [InlineData(FeedbackStatus.InProgress, FeedbackStatus.Done)]
        [InlineData(FeedbackStatus.InProgress, FeedbackStatus.Todo)]
        [InlineData(FeedbackStatus.Done, FeedbackStatus.Todo)]
        [InlineData(FeedbackStatus.Done, FeedbackStatus.InProgress)]
        public void UpdateStatus_AllowsAllTransitionsBetweenTheThreeStatuses(
            FeedbackStatus from, FeedbackStatus to)
        {
            var feedback = EntityBuilders.BuildFeedback();

            // Amène le feedback dans le statut de départ "from"
            if (from != FeedbackStatus.Todo)
                feedback.UpdateStatus(from, _clock.UtcNow);

            var act = () => feedback.UpdateStatus(to, _clock.UtcNow);

            act.Should().NotThrow();
            feedback.Status.Should().Be(to);
        }

        [Fact]
        public void UpdateStatus_SameStatus_ShouldThrow()
        {
            var feedback = EntityBuilders.BuildFeedback();

            var act = () => feedback.UpdateStatus(FeedbackStatus.Todo, _clock.UtcNow);

            act.Should().Throw<InvalidOperationException>()
               .WithMessage("*already*");
        }

        [Fact]
        public void EnrichWithAi_ShouldSetCompletedStatus()
        {
            var feedback = EntityBuilders.BuildFeedback();

            feedback.EnrichWithAi(
                FeedbackCategory.Bug,
                FeedbackPriority.High,
                "Résumé généré par l'IA",
                _clock.UtcNow);

            feedback.Category.Should().Be(FeedbackCategory.Bug);
            feedback.Priority.Should().Be(FeedbackPriority.High);
            feedback.AiSummary.Should().Be("Résumé généré par l'IA");
            feedback.AiAnalysisStatus.Should().Be(AiAnalysisStatus.Completed);
        }

        [Fact]
        public void EnrichWithAi_WithEmptySummary_ShouldThrow()
        {
            var feedback = EntityBuilders.BuildFeedback();

            var act = () => feedback.EnrichWithAi(
                FeedbackCategory.Bug,
                FeedbackPriority.High,
                "",
                _clock.UtcNow);

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void MarkAsFailed_ShouldSetFailedStatus()
        {
            var feedback = EntityBuilders.BuildFeedback();

            feedback.MarkAsFailed("Erreur réseau", _clock.UtcNow);

            feedback.AiAnalysisStatus.Should().Be(AiAnalysisStatus.Failed);
            feedback.AiAnalysisError.Should().Be("Erreur réseau");
        }
    }
}
