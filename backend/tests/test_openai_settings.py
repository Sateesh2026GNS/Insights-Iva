from app.utils.openai_settings import normalize_openai_api_key, normalize_openai_base_url


def test_normalize_openai_api_key_strips_whitespace():
    assert normalize_openai_api_key("  sk-test  ") == "sk-test"
    assert normalize_openai_api_key(None) == ""


def test_normalize_openai_base_url_empty_to_none():
    assert normalize_openai_base_url(None) is None
    assert normalize_openai_base_url("") is None
    assert normalize_openai_base_url("   ") is None


def test_normalize_openai_base_url_appends_v1_for_openai_host():
    assert normalize_openai_base_url("https://api.openai.com") == "https://api.openai.com/v1"
    assert normalize_openai_base_url("https://api.openai.com/") == "https://api.openai.com/v1"
    assert normalize_openai_base_url("https://api.openai.com/v1") == "https://api.openai.com/v1"
    assert normalize_openai_base_url("https://proxy.example/v1") == "https://proxy.example/v1"
