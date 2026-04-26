class AppError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(self, message: str = "Not found"):
        super().__init__(message, 404)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Permission denied"):
        super().__init__(message, 403)


class BadRequestError(AppError):
    def __init__(self, message: str):
        super().__init__(message, 400)


class ConflictError(AppError):
    def __init__(self, message: str):
        super().__init__(message, 409)
