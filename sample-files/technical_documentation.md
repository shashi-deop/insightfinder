# API Documentation - User Authentication Service

## Overview
The User Authentication Service provides secure login, registration, and session management capabilities for our web application. This service uses JWT tokens for stateless authentication and bcrypt for password hashing.

## Endpoints

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "usr_12345",
  "message": "User registered successfully"
}
```

### POST /auth/login
Authenticate user and receive access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "def50200a1b2c3d4e5f6...",
  "expiresIn": 3600
}
```

### POST /auth/refresh
Refresh expired access token using refresh token.

**Headers:**
```
Authorization: Bearer <refresh_token>
```

**Response:**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

### POST /auth/logout
Invalidate user session and tokens.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "User logged out successfully"
}
```

## Security Considerations

### Password Requirements
- Minimum 8 characters
- Must contain at least one uppercase letter
- Must contain at least one lowercase letter
- Must contain at least one number
- Must contain at least one special character

### Token Security
- Access tokens expire after 1 hour
- Refresh tokens expire after 30 days
- All tokens are signed with HS256 algorithm
- Tokens are blacklisted upon logout

### Rate Limiting
- Login attempts: 5 per minute per IP
- Registration: 3 per minute per IP
- Password reset: 1 per 5 minutes per email

## Error Handling

### Common Error Codes
- `400`: Bad Request - Invalid input data
- `401`: Unauthorized - Invalid credentials or expired token
- `403`: Forbidden - Account locked or insufficient permissions
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server-side issue

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect",
    "details": {}
  }
}
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    account_locked BOOLEAN DEFAULT FALSE,
    failed_login_attempts INT DEFAULT 0,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Session Tokens Table
```sql
CREATE TABLE session_tokens (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    token_type ENUM('access', 'refresh') NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## Testing

### Unit Tests
Run the test suite with:
```bash
npm test auth.service.test.js
```

### Integration Tests
```bash
npm run test:integration auth
```

### Test Coverage
Current test coverage: 94.2%

Target coverage: 95%

---
*Last updated: January 10, 2024*  
*Maintainer: Development Team* 