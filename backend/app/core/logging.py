import logging
import re
import sys

SENSITIVE_PATTERNS = [
    re.compile(r"(api[-_]?key[\"']?\s*[:=]\s*[\"']?)([a-zA-Z0-9_\-]{8,})([\"']?)", re.IGNORECASE),
    re.compile(
        r"(authorization[\"']?\s*[:=]\s*[\"']?Bearer\s+)([a-zA-Z0-9_\-\.]+)([\"']?)", re.IGNORECASE
    ),
    re.compile(r"(password[\"']?\s*[:=]\s*[\"']?)([^\"'\s]{4,})([\"']?)", re.IGNORECASE),
    re.compile(r"(secret[\"']?\s*[:=]\s*[\"']?)([^\"'\s]{4,})([\"']?)", re.IGNORECASE),
]


class SafeRedactingFormatter(logging.Formatter):
    """Custom log formatter that masks sensitive tokens, passwords, and API keys."""

    def format(self, record: logging.LogRecord) -> str:
        orig = super().format(record)
        redacted = orig
        for pattern in SENSITIVE_PATTERNS:
            redacted = pattern.sub(r"\1***REDACTED***\3", redacted)
        return redacted


def setup_logging(debug: bool = False) -> logging.Logger:
    level = logging.DEBUG if debug else logging.INFO
    logger = logging.getLogger("voiceforge")
    logger.setLevel(level)

    # Avoid duplicate handlers on reload
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        fmt = SafeRedactingFormatter(
            fmt="%(asctime)s [%(levelname)s] [voiceforge] %(name)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(fmt)
        logger.addHandler(handler)

    return logger


logger = setup_logging()
