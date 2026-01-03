namespace ChatApp.Core.Exceptions;

public class AppException : Exception
{
    public int StatusCode { get; }

    public AppException(string message, int statusCode = 400) : base(message)
    {
        StatusCode = statusCode;
    }
}

public class NotFoundException : AppException
{
    public NotFoundException(string message) : base(message, 404) { }
}

public class UnauthorizedException : AppException
{
    public UnauthorizedException(string message = "Unauthorized") : base(message, 401) { }
}

public class ForbiddenException : AppException
{
    public ForbiddenException(string message = "Forbidden") : base(message, 403) { }
}

public class ConflictException : AppException
{
    public ConflictException(string message) : base(message, 409) { }
}

public class BadRequestException : AppException
{
    public BadRequestException(string message) : base(message, 400) { }
}

public class ValidationException : AppException
{
    public Dictionary<string, string[]> Errors { get; }

    public ValidationException(Dictionary<string, string[]> errors) : base("Validation failed", 400)
    {
        Errors = errors;
    }

    public ValidationException(string field, string message) : base("Validation failed", 400)
    {
        Errors = new Dictionary<string, string[]> { { field, new[] { message } } };
    }
}
