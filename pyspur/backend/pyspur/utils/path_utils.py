from pathlib import Path

PROJECT_ROOT = Path.cwd()


def is_external_url(url: str) -> bool:
    return url.startswith(("http://", "https://", "gs://"))


def get_test_files_dir() -> Path:
    """Get the directory for test file uploads."""
    test_files_dir = Path.joinpath(PROJECT_ROOT, "data", "test_files")
    test_files_dir.mkdir(parents=True, exist_ok=True)
    return test_files_dir


def resolve_file_path(file_path: str) -> Path | str:
    """
    Resolve a file path relative to the project root.
    Expects paths in format 'data/test_files/S9/20250120_121759_aialy.pdf' and resolves them to
    'data/test_files/S9/20250120_121759_aialy.pdf'
    If the path is an external URL (starts with http:// or https://), returns it as is.
    """
    # Handle external URLs
    if is_external_url(file_path):
        return file_path

    path = Path.joinpath(PROJECT_ROOT, "data", Path(file_path))
    if not path.exists():
        raise FileNotFoundError(f"File not found at expected location: {file_path}")
    return path
