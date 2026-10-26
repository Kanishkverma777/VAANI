import io
import re

import docx
import pymupdf

from app.core.exceptions import ValidationException

RE_WHITESPACE = re.compile(r"[ \t]+")
RE_MULTILINE = re.compile(r"\n\s*\n+")


def detect_and_validate_file_type(content: bytes, filename: str) -> str:
    """Validate true file type using magic bytes rather than trusting filename or mime-type alone."""
    if len(content) == 0:
        raise ValidationException("The uploaded file is empty.", code="EMPTY_FILE")

    # PDF Magic bytes: %PDF-
    if content.startswith(b"%PDF-"):
        return "pdf"

    # DOCX is a zip archive with magic bytes PK\x03\x04
    if content.startswith(b"PK\x03\x04") and filename.lower().endswith(".docx"):
        return "docx"

    # TXT: Check utf-8 decodable
    try:
        content[:1024].decode("utf-8")
        if filename.lower().endswith(".txt"):
            return "txt"
    except UnicodeDecodeError:
        pass

    raise ValidationException(
        "Unsupported or corrupt file type. Only valid PDF, DOCX, and TXT files are accepted.",
        code="UNSUPPORTED_FILE_TYPE",
    )


def extract_text_from_document(content: bytes, file_type: str) -> str:
    """Extract clean text content from PDF, DOCX, or TXT."""
    extracted_text = ""

    if file_type == "pdf":
        try:
            doc = pymupdf.open(stream=content, filetype="pdf")
            if doc.is_encrypted:
                raise ValidationException(
                    "Encrypted or password-protected PDF files cannot be processed.",
                    code="ENCRYPTED_FILE",
                )

            pages = []
            for page in doc:
                text = page.get_text()
                if text:
                    pages.append(text)
            extracted_text = "\n".join(pages)
        except ValidationException:
            raise
        except Exception as exc:
            raise ValidationException(
                f"Failed to parse PDF document: {str(exc)}", code="PARSE_ERROR"
            )

    elif file_type == "docx":
        try:
            doc = docx.Document(io.BytesIO(content))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            extracted_text = "\n".join(paragraphs)
        except Exception as exc:
            raise ValidationException(
                f"Failed to parse DOCX document: {str(exc)}", code="PARSE_ERROR"
            )

    elif file_type == "txt":
        try:
            extracted_text = content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                extracted_text = content.decode("latin-1")
            except Exception as exc:
                raise ValidationException(
                    f"Failed to decode text document: {str(exc)}", code="PARSE_ERROR"
                )

    # Normalize whitespace using precompiled patterns
    normalized = RE_WHITESPACE.sub(" ", extracted_text)
    normalized = RE_MULTILINE.sub("\n\n", normalized).strip()

    if not normalized:
        raise ValidationException(
            "No extractable text found in the document.", code="NO_EXTRACTABLE_TEXT"
        )

    return normalized
