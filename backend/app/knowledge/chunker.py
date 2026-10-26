from typing import Any, Dict, List


def chunk_text(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> List[Dict[str, Any]]:
    """Split text into overlapping semantic passages."""
    if not text:
        return []

    # Semantic sentence-boundary sliding window
    chunks: List[Dict[str, Any]] = []
    start = 0
    total_len = len(text)
    chunk_index = 0
    min_split_threshold = chunk_size // 2

    while start < total_len:
        end = min(start + chunk_size, total_len)

        # Look for natural sentence or paragraph termination
        if end < total_len:
            best_break = -1
            # Search candidate window for sentence ends
            search_window = text[start + min_split_threshold:end]
            for delim in ("\n\n", ".\n", "?\n", "!\n", ". ", "? ", "! ", "\n", " "):
                pos = search_window.rfind(delim)
                if pos != -1:
                    best_break = start + min_split_threshold + pos + len(delim.rstrip())
                    break

            if best_break > start:
                end = best_break

        chunk_str = text[start:end].strip()
        if chunk_str:
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "text": chunk_str,
                    "char_count": len(chunk_str),
                }
            )
            chunk_index += 1

        if end >= total_len:
            break

        start = max(end - chunk_overlap, start + 1)

    return chunks
