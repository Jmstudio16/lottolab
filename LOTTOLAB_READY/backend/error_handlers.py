from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging

logger = logging.getLogger(__name__)

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Standardize validation errors to always return {message, details}
    Never return raw Pydantic error objects
    """
    errors = []
    for error in exc.errors():
        error_detail = {
            "field": " -> ".join(str(x) for x in error.get("loc", [])),
            "message": error.get("msg", "Validation error"),
            "type": error.get("type", "unknown")
        }
        errors.append(error_detail)
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "message": "Validation failed",
            "details": errors
        }
    )

async def generic_exception_handler(request: Request, exc: Exception):
    """
    Catch all other exceptions and format properly
    """
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "message": "Internal server error",
            "details": [{"error": str(exc)}]
        }
    )
