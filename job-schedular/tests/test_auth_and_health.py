"""Test suite for authentication, health check, and error formatting."""

from fastapi.testclient import TestClient


def test_health_check_public_access(client: TestClient):
    """GET /health should be public and return structured status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "db" in data
    assert "redis" in data
    assert data["db"] == "connected"


def test_protected_endpoints_require_auth(client: TestClient):
    """Protected /jobs/* endpoints must return 401 when Authorization is missing."""
    response = client.post("/jobs/forgot-password", json={"user_id": "u1", "reset_token": "tok12345"})
    assert response.status_code == 401
    assert "error" in response.json()
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_protected_endpoints_reject_invalid_token(client: TestClient):
    """Protected /jobs/* endpoints must return 401 when Bearer token is wrong."""
    headers = {"Authorization": "Bearer invalid_fake_token_123"}
    response = client.post(
        "/jobs/forgot-password",
        json={"user_id": "u1", "reset_token": "tok12345"},
        headers=headers
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_protected_endpoints_accept_valid_token(client: TestClient, auth_headers: dict, seed_user):
    """Protected /jobs/* endpoints accept valid INTERNAL_SERVICE_TOKEN."""
    response = client.post(
        "/jobs/forgot-password",
        json={"user_id": seed_user.id, "reset_token": "valid_secure_token_12345"},
        headers=auth_headers
    )
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "QUEUED"
    assert "task_id" in data


def test_api_error_format_consistency(client: TestClient, auth_headers: dict):
    """Verify uniform error structure { error: { code, message } } on not found resources."""
    response = client.post(
        "/jobs/order-placed",
        json={"order_id": "non_existent_order_id_999"},
        headers=auth_headers
    )
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "NOT_FOUND"
    assert "non_existent_order_id_999" in data["error"]["message"]


def test_facebook_otp_job_enqueue(client: TestClient, auth_headers: dict):
    """Verify /jobs/facebook-otp returns HTTP 202 Accepted and task_id."""
    response = client.post(
        "/jobs/facebook-otp",
        json={"email": "fbtest@example.com", "otp": "998877"},
        headers=auth_headers
    )
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "QUEUED"
    assert "task_id" in data

