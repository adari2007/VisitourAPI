# API Documentation

Complete API reference for Visitour backend.

## Base URL

```
http://localhost:3000/api
```

## Authentication

All endpoints (except `/auth/register` and `/auth/login`) require JWT authentication.

Include token in request header:
```
Authorization: Bearer <your-jwt-token>
```

## Response Format

All responses are JSON:

**Success (2xx)**
```json
{
  "message": "Success message",
  "data": { ... },
  "itinerary": { ... }
}
```

**Error (4xx, 5xx)**
```json
{
  "error": "Error message",
  "details": []
}
```

## Endpoints

### Authentication

#### Register
Creates a new user account.

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201)**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "token": "eyJhbGc..."
}
```

**Errors**
- `400` - Invalid input
- `409` - Email already registered

---

#### Login
Authenticates user and returns JWT token.

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200)**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "token": "eyJhbGc..."
}
```

**Errors**
- `400` - Invalid input
- `401` - Invalid credentials

---

### Itineraries

#### List Itineraries
Gets all itineraries for the authenticated user.

```http
GET /itineraries
Authorization: Bearer <token>
```

**Response (200)**
```json
{
  "itineraries": [
    {
      "id": "uuid-1",
      "title": "Paris Trip",
      "description": "Summer vacation",
      "startDate": "2024-06-01",
      "endDate": "2024-06-10",
      "isPublic": false,
      "createdAt": "2024-04-30T10:00:00Z",
      "updatedAt": "2024-04-30T10:00:00Z"
    }
  ]
}
```

---

#### Create Itinerary
Creates a new itinerary.

```http
POST /itineraries
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Paris Trip",
  "description": "Summer vacation",
  "startDate": "2024-06-01",
  "endDate": "2024-06-10",
  "isPublic": false
}
```

**Response (201)**
```json
{
  "message": "Itinerary created",
  "itinerary": {
    "id": "uuid",
    "title": "Paris Trip",
    "description": "Summer vacation",
    "startDate": "2024-06-01",
    "endDate": "2024-06-10",
    "isPublic": false,
    "createdAt": "2024-04-30T10:00:00Z",
    "updatedAt": "2024-04-30T10:00:00Z"
  }
}
```

**Validation**
- `title`: Required, max 255 chars
- `startDate`, `endDate`: Required, format YYYY-MM-DD
- `description`: Optional

**Errors**
- `400` - Validation error
- `401` - Unauthorized

---

#### Get Itinerary
Gets a specific itinerary (user must own it).

```http
GET /itineraries/{id}
Authorization: Bearer <token>
```

**Response (200)**
```json
{
  "itinerary": {
    "id": "uuid",
    "title": "Paris Trip",
    ...
  }
}
```

**Errors**
- `404` - Itinerary not found
- `401` - Not authorized

---

#### Update Itinerary
Updates an itinerary (user must own it).

```http
PUT /itineraries/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Paris Trip 2024",
  "description": "Extended summer vacation"
}
```

**Response (200)**
```json
{
  "message": "Itinerary updated",
  "itinerary": { ... }
}
```

**Errors**
- `404` - Itinerary not found
- `400` - Validation error

---

#### Delete Itinerary
Deletes an itinerary and all its entries.

```http
DELETE /itineraries/{id}
Authorization: Bearer <token>
```

**Response (200)**
```json
{
  "message": "Itinerary deleted"
}
```

**Errors**
- `404` - Itinerary not found

---

### Entries

#### Get Entries for Itinerary
Gets all entries for a specific itinerary.

```http
GET /entries/itinerary/{itineraryId}
Authorization: Bearer <token>
```

**Response (200)**
```json
{
  "entries": [
    {
      "id": "uuid",
      "itineraryId": "uuid",
      "dayNumber": 1,
      "date": "2024-06-01",
      "title": "Arrive in Paris",
      "description": "Flight arrives",
      "location": "Charles de Gaulle",
      "timeStart": "14:00",
      "timeEnd": "15:30",
      "category": "transport",
      "customDetails": {},
      "orderIndex": 0,
      "createdAt": "2024-04-30T10:00:00Z",
      "updatedAt": "2024-04-30T10:00:00Z"
    }
  ]
}
```

---

#### Create Entry
Creates a new entry in an itinerary.

```http
POST /entries/itinerary/{itineraryId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "dayNumber": 1,
  "date": "2024-06-01",
  "title": "Arrive in Paris",
  "description": "Flight arrives at 2 PM",
  "location": "Charles de Gaulle Airport",
  "timeStart": "14:00",
  "timeEnd": "15:30",
  "category": "transport",
  "customDetails": {
    "flightNumber": "AF123",
    "airline": "Air France"
  }
}
```

**Response (201)**
```json
{
  "message": "Entry created",
  "entry": { ... }
}
```

**Validation**
- `dayNumber`: Required, positive integer
- `date`: Required, format YYYY-MM-DD
- `title`: Required, max 255 chars
- `category`: One of: accommodation, activity, meal, transport, other
- `timeStart`, `timeEnd`: Optional, format HH:MM

**Errors**
- `400` - Validation error
- `404` - Itinerary not found

---

#### Update Entry
Updates an entry.

```http
PUT /entries/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated title",
  "timeStart": "15:00"
}
```

**Response (200)**
```json
{
  "message": "Entry updated",
  "entry": { ... }
}
```

---

#### Delete Entry
Deletes an entry.

```http
DELETE /entries/{id}
Authorization: Bearer <token>
```

**Response (200)**
```json
{
  "message": "Entry deleted"
}
```

---

## Entry Categories

- `accommodation` - Hotels, hostels, airbnb
- `activity` - Tours, attractions, museums
- `meal` - Restaurants, food experiences
- `transport` - Flights, trains, taxis
- `other` - Miscellaneous

---

## Date/Time Formats

- **Date**: YYYY-MM-DD (e.g., 2024-06-01)
- **Time**: HH:MM (e.g., 14:00)
- **ISO 8601**: Full timestamps with timezone

---

## WebSocket Events

Real-time updates via Socket.io.

### Connect
```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected');
  socket.emit('join-itinerary', 'itinerary-id');
});
```

### Events

**Entry Created**
```javascript
socket.on('entry-created', (data) => {
  // { id, itineraryId, title, ... }
});
```

**Entry Updated**
```javascript
socket.on('entry-updated', (data) => {
  // { id, itineraryId, title, ... }
});
```

**Entry Deleted**
```javascript
socket.on('entry-deleted', (data) => {
  // { id, itineraryId }
});
```

**Itinerary Updated**
```javascript
socket.on('itinerary-updated', (data) => {
  // { id, title, ... }
});
```

---

## Rate Limiting

No rate limiting currently, but will be added in production.

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400  | Bad Request - Invalid input |
| 401  | Unauthorized - Missing or invalid token |
| 404  | Not Found - Resource doesn't exist |
| 409  | Conflict - Resource already exists |
| 500  | Server Error |

---

## Examples

### cURL

**Register**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "firstName": "John"
  }'
```

**Create Itinerary**
```bash
TOKEN="your-jwt-token"
curl -X POST http://localhost:3000/api/itineraries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Paris Trip",
    "startDate": "2024-06-01",
    "endDate": "2024-06-10"
  }'
```

### JavaScript

```javascript
const API_BASE = 'http://localhost:3000/api';

// Register
const registerRes = await fetch(`${API_BASE}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});
const { token } = await registerRes.json();

// Create Itinerary
const itinRes = await fetch(`${API_BASE}/itineraries`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    title: 'Paris Trip',
    startDate: '2024-06-01',
    endDate: '2024-06-10'
  })
});
const itinerary = await itinRes.json();
```

---

## Rate Limits (Future)

- 100 requests per minute per user
- 1000 requests per hour per IP

---

**Last Updated**: 2024-04-30

