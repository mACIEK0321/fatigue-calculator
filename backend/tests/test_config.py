"""Configuration tests for environment-driven settings."""

from app.core import config


def test_settings_default_to_local_development(monkeypatch) -> None:
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    config.get_settings.cache_clear()

    settings = config.get_settings()

    assert settings.ENVIRONMENT == "development"
    assert settings.ALLOWED_ORIGINS == ["http://localhost:3000"]
    assert settings.GROQ_BASE_URL == "https://api.groq.com/openai/v1"
    assert settings.GROQ_MODEL == "openai/gpt-oss-20b"
    assert settings.GROQ_RESPONSE_FORMAT == "auto"
    assert settings.GROQ_TIMEOUT_SECONDS == 20.0


def test_settings_parse_comma_separated_origins(monkeypatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv(
        "ALLOWED_ORIGINS",
        "https://fatigue-calculator.vercel.app/, https://preview.example.com",
    )
    config.get_settings.cache_clear()

    settings = config.get_settings()

    assert settings.ENVIRONMENT == "production"
    assert settings.ALLOWED_ORIGINS == [
        "https://fatigue-calculator.vercel.app",
        "https://preview.example.com",
    ]


def test_settings_reject_wildcard_origin_in_production(monkeypatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("ALLOWED_ORIGINS", "*")
    config.get_settings.cache_clear()

    try:
        config.get_settings()
    except ValueError as exc:
        assert "cannot contain '*'" in str(exc)
    else:
        raise AssertionError("Expected ValueError for wildcard origin in production.")


def test_settings_reject_non_positive_groq_timeout(monkeypatch) -> None:
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    monkeypatch.setenv("GROQ_TIMEOUT_SECONDS", "0")
    config.get_settings.cache_clear()

    try:
        config.get_settings()
    except ValueError as exc:
        assert "GROQ_TIMEOUT_SECONDS" in str(exc)
    else:
        raise AssertionError("Expected ValueError for non-positive Groq timeout.")


def test_settings_reject_invalid_groq_response_format(monkeypatch) -> None:
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    monkeypatch.setenv("GROQ_RESPONSE_FORMAT", "yaml")
    config.get_settings.cache_clear()

    try:
        config.get_settings()
    except ValueError as exc:
        assert "GROQ_RESPONSE_FORMAT" in str(exc)
    else:
        raise AssertionError("Expected ValueError for invalid Groq response format.")
