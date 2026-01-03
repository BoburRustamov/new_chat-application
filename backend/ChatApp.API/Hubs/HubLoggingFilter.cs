using Microsoft.AspNetCore.SignalR;
using Serilog;
using System.Diagnostics;

namespace ChatApp.API.Hubs;

/// <summary>
/// SignalR Hub filter for logging hub invocations and errors
/// </summary>
public class HubLoggingFilter : IHubFilter
{
    private readonly ILogger<HubLoggingFilter> _logger;

    public HubLoggingFilter(ILogger<HubLoggingFilter> logger)
    {
        _logger = logger;
    }

    public async ValueTask<object?> InvokeMethodAsync(
        HubInvocationContext invocationContext,
        Func<HubInvocationContext, ValueTask<object?>> next)
    {
        var hubName = invocationContext.Hub.GetType().Name;
        var methodName = invocationContext.HubMethodName;
        var connectionId = invocationContext.Context.ConnectionId;
        var userId = invocationContext.Context.UserIdentifier ?? "anonymous";

        var stopwatch = Stopwatch.StartNew();

        _logger.LogInformation(
            "Hub invocation started: {HubName}.{MethodName} by user {UserId} (connection: {ConnectionId})",
            hubName, methodName, userId, connectionId);

        try
        {
            var result = await next(invocationContext);
            stopwatch.Stop();

            _logger.LogInformation(
                "Hub invocation completed: {HubName}.{MethodName} by user {UserId} in {ElapsedMs}ms",
                hubName, methodName, userId, stopwatch.ElapsedMilliseconds);

            return result;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();

            _logger.LogError(ex,
                "Hub invocation failed: {HubName}.{MethodName} by user {UserId} after {ElapsedMs}ms. Error: {ErrorMessage}",
                hubName, methodName, userId, stopwatch.ElapsedMilliseconds, ex.Message);

            throw;
        }
    }

    public Task OnConnectedAsync(
        HubLifetimeContext context,
        Func<HubLifetimeContext, Task> next)
    {
        var hubName = context.Hub.GetType().Name;
        var connectionId = context.Context.ConnectionId;
        var userId = context.Context.UserIdentifier ?? "anonymous";

        _logger.LogInformation(
            "Client connected to {HubName}: user {UserId} (connection: {ConnectionId})",
            hubName, userId, connectionId);

        return next(context);
    }

    public Task OnDisconnectedAsync(
        HubLifetimeContext context,
        Exception? exception,
        Func<HubLifetimeContext, Exception?, Task> next)
    {
        var hubName = context.Hub.GetType().Name;
        var connectionId = context.Context.ConnectionId;
        var userId = context.Context.UserIdentifier ?? "anonymous";

        if (exception != null)
        {
            _logger.LogWarning(exception,
                "Client disconnected from {HubName} with error: user {UserId} (connection: {ConnectionId})",
                hubName, userId, connectionId);
        }
        else
        {
            _logger.LogInformation(
                "Client disconnected from {HubName}: user {UserId} (connection: {ConnectionId})",
                hubName, userId, connectionId);
        }

        return next(context, exception);
    }
}

/// <summary>
/// Rate limiting filter for SignalR hub methods
/// </summary>
public class HubRateLimitFilter : IHubFilter
{
    private readonly ILogger<HubRateLimitFilter> _logger;
    private readonly Dictionary<string, Queue<DateTime>> _requestTimestamps = new();
    private readonly object _lock = new();

    // Rate limit settings: 100 requests per minute per user
    private const int MaxRequests = 100;
    private static readonly TimeSpan TimeWindow = TimeSpan.FromMinutes(1);

    public HubRateLimitFilter(ILogger<HubRateLimitFilter> logger)
    {
        _logger = logger;
    }

    public async ValueTask<object?> InvokeMethodAsync(
        HubInvocationContext invocationContext,
        Func<HubInvocationContext, ValueTask<object?>> next)
    {
        var userId = invocationContext.Context.UserIdentifier ?? invocationContext.Context.ConnectionId;
        var methodName = invocationContext.HubMethodName;

        if (!IsAllowed(userId))
        {
            _logger.LogWarning(
                "Rate limit exceeded for user {UserId} on method {MethodName}",
                userId, methodName);

            throw new HubException("Rate limit exceeded. Please slow down.");
        }

        return await next(invocationContext);
    }

    private bool IsAllowed(string userId)
    {
        lock (_lock)
        {
            var now = DateTime.UtcNow;
            var cutoff = now - TimeWindow;

            if (!_requestTimestamps.TryGetValue(userId, out var timestamps))
            {
                timestamps = new Queue<DateTime>();
                _requestTimestamps[userId] = timestamps;
            }

            // Remove old timestamps
            while (timestamps.Count > 0 && timestamps.Peek() < cutoff)
            {
                timestamps.Dequeue();
            }

            if (timestamps.Count >= MaxRequests)
            {
                return false;
            }

            timestamps.Enqueue(now);
            return true;
        }
    }
}

/// <summary>
/// Exception handling filter for SignalR hub methods
/// </summary>
public class HubExceptionFilter : IHubFilter
{
    private readonly ILogger<HubExceptionFilter> _logger;

    public HubExceptionFilter(ILogger<HubExceptionFilter> logger)
    {
        _logger = logger;
    }

    public async ValueTask<object?> InvokeMethodAsync(
        HubInvocationContext invocationContext,
        Func<HubInvocationContext, ValueTask<object?>> next)
    {
        try
        {
            return await next(invocationContext);
        }
        catch (HubException)
        {
            // Re-throw HubExceptions as they already have user-friendly messages
            throw;
        }
        catch (ChatApp.Core.Exceptions.NotFoundException ex)
        {
            _logger.LogWarning(ex, "Not found error in hub method {MethodName}", invocationContext.HubMethodName);
            throw new HubException(ex.Message);
        }
        catch (ChatApp.Core.Exceptions.ForbiddenException ex)
        {
            _logger.LogWarning(ex, "Forbidden error in hub method {MethodName}", invocationContext.HubMethodName);
            throw new HubException(ex.Message);
        }
        catch (ChatApp.Core.Exceptions.BadRequestException ex)
        {
            _logger.LogWarning(ex, "Bad request error in hub method {MethodName}", invocationContext.HubMethodName);
            throw new HubException(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled error in hub method {MethodName}", invocationContext.HubMethodName);
            throw new HubException("An unexpected error occurred. Please try again.");
        }
    }
}
