"""Map domain exceptions to HTTP responses in one place."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.exceptions import LoanWizardError
from app.core.logging import get_logger

log = get_logger(__name__)


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(LoanWizardError)
    async def _domain_handler(_: Request, exc: LoanWizardError) -> JSONResponse:
        log.warning("api.domain_error", code=exc.code, detail=str(exc))
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.code, "detail": str(exc)},
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("api.unhandled", error=str(exc))
        return JSONResponse(
            status_code=500,
            content={"error": "internal_error", "detail": "An unexpected error occurred."},
        )
