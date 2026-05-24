using AiReviewHub.Domain.Exceptions;
using FluentValidation;
using System.Net;

namespace AiReviewHub.Api.Middleware
{
    public class ExceptionMiddleware
    {
        private readonly RequestDelegate _next;

        public ExceptionMiddleware(RequestDelegate next) => _next = next;

        public async Task Invoke(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (ValidationException ex)
            {
                await HandleValidationException(context, ex);
            }
            catch (NotFoundException ex)
            {
                await HandleException(context, ex, HttpStatusCode.NotFound);
            }
            catch (ConflictException ex)
            {
                await HandleException(context, ex, HttpStatusCode.Conflict);
            }
            catch (ForbiddenException ex)
            {
                await HandleException(context, ex, HttpStatusCode.Forbidden);
            }
            catch (QuotaExceededException ex)
            {
                await HandleQuotaExceededException(context, ex);
            }
            catch (UnauthorizedAccessException ex)
            {
                await HandleException(context, ex, HttpStatusCode.Unauthorized);
            }
            catch (Exception ex)
            {
                await HandleUnexpectedException(context, ex);
            }
        }

        private static async Task HandleValidationException(HttpContext context, ValidationException ex)
        {
            context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
            context.Response.ContentType = "application/json";

            var errors = ex.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(e => e.ErrorMessage).ToArray()
                );

            await context.Response.WriteAsJsonAsync(new
            {
                type = "ValidationError",
                errors
            });
        }

        private static async Task HandleException(HttpContext context, Exception ex, HttpStatusCode statusCode)
        {
            context.Response.StatusCode = (int)statusCode;
            context.Response.ContentType = "application/json";

            await context.Response.WriteAsJsonAsync(new
            {
                type = ex.GetType().Name,
                error = ex.Message
            });
        }

        private static async Task HandleUnexpectedException(HttpContext context, Exception ex)
        {
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
            context.Response.ContentType = "application/json";

            // Ne jamais exposer les détails en prod
            await context.Response.WriteAsJsonAsync(new
            {
                type = "InternalServerError",
                error = "An unexpected error occurred"
            });
        }

        private static async Task HandleQuotaExceededException(HttpContext context, QuotaExceededException ex)
        {
            context.Response.StatusCode = 429;
            context.Response.ContentType = "application/json";

            await context.Response.WriteAsJsonAsync(new
            {
                type = nameof(QuotaExceededException),
                error = ex.Message,
                current = ex.Current,
                limit = ex.Limit,
                resetDate = ex.ResetDate.ToString("yyyy-MM-dd")
            });
        }
    }
}
