# 🔧 Technician Service — Microservice

A dedicated technician microservice for the **Infrastructure Report System**, built with **Node.js**, **Express.js**, and **MongoDB**.

The service manages technician work orders, job status updates, repair progress photos, and in-app notifications. It communicates with the **Manager Service** through an internal authenticated endpoint and provides protected APIs for the Technician Mobile App.

---

## 📑 Table of Contents

* [🚀 Features](#-features)
* [🛠️ Tech Stack](#️-tech-stack)
* [📋 Prerequisites](#-prerequisites)
* [📦 Installation](#-installation)
* [⚙️ Environment Configuration](#️-environment-configuration)
* [🔌 API Documentation](#-api-documentation)

  * [System & Health Check](#1-system--health-check)
  * [Internal Notifications](#2-internal-notifications)
  * [Technician Jobs](#3-technician-jobs)
  * [Job Status](#4-job-status)
  * [Progress Photos](#5-progress-photos)
  * [Technician Notifications](#6-technician-notifications)
* [🛡️ Security](#️-security)
* [📄 Pagination](#-pagination)
* [▶️ Running the Application](#️-running-the-application)
* [🌐 Architecture](#-architecture)

---

# 🚀 Features

### 🔧 Work Order Management

* Retrieve assigned work orders
* Paginated job lists
* Filter jobs by status
* Verify technician assignment before accessing a job
* Populate related infrastructure reports

### 🔄 Job Status Management

Technicians can update their assigned work orders through the following states:

```text
ACCEPTED
IN_PROGRESS
COMPLETED
```

When a work order is marked as `COMPLETED`, its associated report is automatically updated to:

```text
repaired
```

### 📸 Progress Photo Upload

* Upload repair progress images
* Supports up to 5 images per request
* Images are stored using Cloudinary
* Uploaded image URLs are stored in the work order

### 🔔 In-App Notifications

* Receive notifications from the Manager Service
* Adaptive polling support
* Paginated notification retrieval
* Unread notification count
* Mark individual notifications as read
* Mark all notifications as read

### 🔐 Internal Service Communication

The Manager Service can create technician notifications through a protected internal endpoint using an internal secret.

---

# 🛠️ Tech Stack

| Technology             | Purpose                       |
| ---------------------- | ----------------------------- |
| **Node.js**            | JavaScript runtime            |
| **Express.js**         | REST API framework            |
| **MongoDB**            | Database                      |
| **Mongoose**           | MongoDB ODM                   |
| **Cloudinary**         | Progress image storage        |
| **JWT**                | Technician authentication     |
| **Helmet**             | HTTP security headers         |
| **CORS**               | Cross-origin request handling |
| **Express Rate Limit** | Request rate limiting         |

---

# 📋 Prerequisites

Before running the service, make sure you have:

* **Node.js 16+**
* **MongoDB**
* **Cloudinary account**
* A configured JWT authentication system
* Access to the Manager Service secret for internal communication

---

# 📦 Installation

## 1. Clone the repository

```bash
git clone <your-repository-url>
```

## 2. Enter the project directory

```bash
cd technician-service
```

## 3. Install dependencies

```bash
npm install
```

---

# ⚙️ Environment Configuration

Create a `.env` file in the root directory:

```env
PORT=8004
NODE_ENV=development

MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/technician_db

JWT_SECRET=your_secure_jwt_secret

INTERNAL_SECRET=your_internal_service_secret

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Environment Variables

| Variable                | Description                                   |
| ----------------------- | --------------------------------------------- |
| `PORT`                  | Port used by the service                      |
| `NODE_ENV`              | Application environment                       |
| `MONGO_URI`             | MongoDB connection string                     |
| `JWT_SECRET`            | Secret used for JWT authentication            |
| `INTERNAL_SECRET`       | Secret used for Manager Service communication |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name                         |
| `CLOUDINARY_API_KEY`    | Cloudinary API key                            |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret                         |

> ⚠️ **Security:** Never commit `.env`, JWT secrets, internal secrets, MongoDB credentials, or Cloudinary credentials to a public repository.

Add `.env` to `.gitignore`:

```gitignore
.env
```

---

# 🔌 API Documentation

Base URL for local development:

```text
http://localhost:8004
```

## Endpoint Overview

| Method  | Endpoint                                     | Access          | Description                     |
| ------- | -------------------------------------------- | --------------- | ------------------------------- |
| `GET`   | `/`                                          | Public          | Service information             |
| `GET`   | `/api/technician/health`                     | Public          | Health check                    |
| `POST`  | `/api/internal/notifications`                | Internal Secret | Create technician notifications |
| `GET`   | `/api/technician/jobs`                       | Technician JWT  | Get assigned jobs               |
| `PATCH` | `/api/technician/jobs/:workOrderId/status`   | Technician JWT  | Update job status               |
| `POST`  | `/api/technician/jobs/:workOrderId/progress` | Technician JWT  | Upload progress photos          |
| `GET`   | `/api/technician/notifications`              | Technician JWT  | Get notifications               |
| `PATCH` | `/api/technician/notifications/read-all`     | Technician JWT  | Mark all notifications as read  |
| `PATCH` | `/api/technician/notifications/:id/read`     | Technician JWT  | Mark one notification as read   |

---

# 1. System & Health Check

## `GET /`

**Access:** Public

Returns basic information about the Technician Service.

### Example Response

```json
{
  "serviceName": "Infrastructure-Report Technician Service",
  "status": "Technician Service Active",
  "port": "8004",
  "serviceRole": "Technician",
  "versionType": "alpha",
  "versionNumber": "0.0.1"
}
```

---

## `GET /api/technician/health`

**Access:** Public

Returns the current service health status.

### Example Response

```json
{
  "status": "Technician Service Active",
  "port": 8004
}
```

---

# 2. Internal Notifications

## `POST /api/internal/notifications`

**Access:** Internal Service Secret

This endpoint is intended to be called by the **Manager Service**.

The request must contain the internal secret:

```http
x-internal-secret: <INTERNAL_SECRET>
```

### Request Body

```json
{
  "recipientId": "TECHNICIAN_ID",
  "title": "New Work Order",
  "message": "You have been assigned a new infrastructure repair.",
  "workOrderId": "WORK_ORDER_ID",
  "type": "NEW_WORK_ORDER"
}
```

The endpoint also supports:

```json
{
  "assignedTechnicianIds": [
    "TECHNICIAN_ID_1",
    "TECHNICIAN_ID_2"
  ],
  "title": "New Work Order",
  "message": "A new work order has been assigned.",
  "workOrderId": "WORK_ORDER_ID",
  "type": "NEW_WORK_ORDER"
}
```

### Supported Recipient Fields

The service can receive technician IDs through:

* `recipientId`
* `technicianId`
* `assignedTechnicianIds`

Duplicate technician IDs are removed before notifications are created.

### Success Response

```json
{
  "success": true,
  "message": "Notifications stored successfully.",
  "count": 2
}
```

---

# 3. Technician Jobs

## `GET /api/technician/jobs`

**Access:** Technician JWT

Returns work orders assigned to the authenticated technician.

### Authentication

```http
Authorization: Bearer <TECHNICIAN_JWT_TOKEN>
```

### Query Parameters

| Parameter | Description                 | Default | Maximum |
| --------- | --------------------------- | ------: | ------: |
| `page`    | Page number                 |     `1` |       — |
| `limit`   | Records per page            |    `10` |    `50` |
| `status`  | Filter by work order status |       — |       — |

### Example

```http
GET /api/technician/jobs?page=1&limit=10&status=IN_PROGRESS
```

### Assignment Matching

A work order can be matched to the authenticated technician through:

```text
assignedTechnicianIds
```

or:

```text
technicians.technicianId
```

or:

```text
technicians.email
```

### Example Response

```json
{
  "data": [
    {
      "_id": "WORK_ORDER_ID",
      "status": "IN_PROGRESS",
      "assignedTechnicianIds": [
        "TECHNICIAN_ID"
      ],
      "reportId": {
        "_id": "REPORT_ID"
      }
    }
  ],
  "meta": {
    "currentPage": 1,
    "pageSize": 10,
    "totalPages": 1,
    "totalRecords": 1
  }
}
```

---

# 4. Job Status

## `PATCH /api/technician/jobs/:workOrderId/status`

**Access:** Technician JWT

Updates the status of an assigned work order.

### Authentication

```http
Authorization: Bearer <TECHNICIAN_JWT_TOKEN>
```

### Request Body

```json
{
  "status": "IN_PROGRESS"
}
```

### Supported Statuses

```text
ACCEPTED
IN_PROGRESS
COMPLETED
```

### Example Request

```http
PATCH /api/technician/jobs/WORK_ORDER_ID/status
```

```json
{
  "status": "COMPLETED"
}
```

The service verifies that the authenticated technician is assigned to the work order before allowing the status update.

### Completion Behavior

When the status changes to:

```text
COMPLETED
```

and the work order has an associated report, the report status is updated to:

```text
repaired
```

### Success Response

```json
{
  "message": "Job order status updated to COMPLETED.",
  "workOrder": {
    "_id": "WORK_ORDER_ID",
    "status": "COMPLETED"
  }
}
```

---

# 5. Progress Photos

## `POST /api/technician/jobs/:workOrderId/progress`

**Access:** Technician JWT

Uploads repair progress photos for an assigned work order.

### Authentication

```http
Authorization: Bearer <TECHNICIAN_JWT_TOKEN>
```

### Content Type

```http
Content-Type: multipart/form-data
```

### Form Field

```text
progressPhotos
```

Up to **5 images** can be uploaded in a single request.

### Example Request

```text
POST /api/technician/jobs/WORK_ORDER_ID/progress
```

Form data:

```text
progressPhotos = image1.jpg
progressPhotos = image2.jpg
progressPhotos = image3.jpg
```

### Storage

Images are uploaded to Cloudinary under:

```text
technician_progress
```

The resulting secure URLs are stored in the work order's:

```text
progressImages
```

field.

### Success Response

```json
{
  "message": "Progress photos uploaded successfully.",
  "progressImages": [
    "https://res.cloudinary.com/example/image/upload/...",
    "https://res.cloudinary.com/example/image/upload/..."
  ]
}
```

---

# 6. Technician Notifications

## Get Notifications

### `GET /api/technician/notifications`

**Access:** Technician JWT

Returns notifications belonging to the authenticated technician.

### Authentication

```http
Authorization: Bearer <TECHNICIAN_JWT_TOKEN>
```

### Query Parameters

| Parameter | Description            | Default | Maximum |
| --------- | ---------------------- | ------: | ------: |
| `page`    | Page number            |     `1` |       — |
| `limit`   | Notifications per page |    `10` |    `50` |

### Example

```http
GET /api/technician/notifications?page=1&limit=10
```

### Response

```json
{
  "data": [
    {
      "_id": "NOTIFICATION_ID",
      "technicianId": "TECHNICIAN_ID",
      "recipientId": "TECHNICIAN_ID",
      "title": "New Work Order",
      "message": "A new work order has been assigned.",
      "type": "NEW_WORK_ORDER",
      "workOrderId": "WORK_ORDER_ID",
      "isRead": false
    }
  ],
  "meta": {
    "currentPage": 1,
    "pageSize": 10,
    "totalPages": 2,
    "totalRecords": 15,
    "unreadCount": 5
  }
}
```

---

## Mark Notification as Read

### `PATCH /api/technician/notifications/:id/read`

**Access:** Technician JWT

Marks a single notification as read.

### Example

```http
PATCH /api/technician/notifications/NOTIFICATION_ID/read
```

### Success Response

```json
{
  "message": "Notification marked as read.",
  "notification": {
    "_id": "NOTIFICATION_ID",
    "isRead": true
  }
}
```

The service verifies that the notification belongs to the authenticated technician before updating it.

---

## Mark All Notifications as Read

### `PATCH /api/technician/notifications/read-all`

**Access:** Technician JWT

Marks all unread notifications belonging to the authenticated technician as read.

### Example

```http
PATCH /api/technician/notifications/read-all
```

### Success Response

```json
{
  "success": true,
  "message": "All notifications marked as read."
}
```

---

# 🛡️ Security

## JWT Authentication

Technician endpoints require a valid JWT.

```http
Authorization: Bearer <TECHNICIAN_JWT_TOKEN>
```

The technician ID is extracted from the authenticated request:

```text
req.user.id
req.user._id
req.user.userId
```

The service uses the available ID to identify the authenticated technician.

---

## Assignment-Based Authorization

Access to work orders is restricted to technicians assigned to the specific work order.

The service checks:

```text
assignedTechnicianIds
```

and:

```text
technicians.technicianId
```

and:

```text
technicians.email
```

This prevents an authenticated technician from modifying another technician's work order.

---

## Internal Service Authentication

The Manager Service communicates with the Technician Service through:

```http
x-internal-secret: <INTERNAL_SECRET>
```

Requests without the correct secret are rejected with:

```http
401 Unauthorized
```

---

## Rate Limiting

Technician API routes are protected by an Express rate limiter configured for:

```text
1,200 requests per 15 minutes
```

This higher limit is intended to support the Technician Mobile App's adaptive notification polling.

The limiter applies to routes under:

```text
/api/technician
```

> Rate limiting is an abuse-prevention mechanism and should not be considered a complete DDoS protection solution.

---

## Helmet

The service uses Helmet to add security-related HTTP headers.

```javascript
app.use(helmet());
```

---

## CORS

CORS is enabled for communication with frontend applications:

```javascript
app.use(cors());
```

---

# 📄 Pagination

The service supports pagination on job and notification endpoints.

The general format is:

```text
?page=1&limit=10
```

### Pagination Rules

```text
Minimum page: 1
Maximum limit: 50
```

For example:

```http
GET /api/technician/jobs?page=2&limit=20
```

Response metadata includes:

```json
{
  "meta": {
    "currentPage": 2,
    "pageSize": 20,
    "totalPages": 5,
    "totalRecords": 100
  }
}
```

---

# 🔔 Notification Flow

Notifications are designed to support communication between the Manager Service and the Technician Mobile App.

```text
┌─────────────────┐
│  Manager Service│
└────────┬────────┘
         │
         │ POST /api/internal/notifications
         │ x-internal-secret
         ▼
┌─────────────────────┐
│  Technician Service │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│      MongoDB        │
│    Notifications    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Technician Mobile   │
│        App          │
└──────────┬──────────┘
           │
           ├── GET notifications
           │
           ├── Mark one as read
           │
           └── Mark all as read
```

The notification API is designed to support **adaptive polling** from the Technician Mobile App.

---

# 🔄 Technician Workflow

The intended technician workflow can be represented as:

```text
       Manager assigns job
              │
              ▼
       Notification created
              │
              ▼
      Technician receives
         notification
              │
              ▼
       View assigned job
              │
              ▼
       Accept the job
              │
              ▼
        IN_PROGRESS
              │
              ▼
      Upload progress photos
              │
              ▼
          COMPLETED
              │
              ▼
     Report → "repaired"
```

---

# ▶️ Running the Application

## Development

Run the service using your development script:

```bash
npm run dev
```

Or run directly:

```bash
node server.js
```

The service runs on:

```text
http://localhost:8004
```

unless another port is configured through the `PORT` environment variable.

---

## Production

Run:

```bash
npm start
```

When:

```env
NODE_ENV=production
```

the service does not start a local HTTP listener and instead exports the Express application for use by a serverless platform.

---

# 🌐 Architecture

The Technician Service operates as an independent microservice within the Infrastructure Report System.

```text
                         ┌────────────────────┐
                         │   Manager Service   │
                         └─────────┬──────────┘
                                   │
                          Internal Secret
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │   Technician Service     │
                    │                          │
                    │  ┌────────────────────┐  │
                    │  │   Express.js API   │  │
                    │  └─────────┬──────────┘  │
                    │            │             │
                    │     ┌──────┴──────┐      │
                    │     │             │      │
                    │  Jobs       Notifications │
                    │     │             │      │
                    └─────┼─────────────┼──────┘
                          │             │
                          ▼             ▼
                    ┌────────────────────────┐
                    │        MongoDB         │
                    └────────────────────────┘

                          │
                          │ Progress Images
                          ▼
                    ┌────────────────────────┐
                    │       Cloudinary       │
                    └────────────────────────┘

                          ▲
                          │
                    JWT Authentication
                          │
                    ┌─────┴────────────┐
                    │ Technician Mobile│
                    │       App        │
                    └──────────────────┘
```

---

# 📌 Service Responsibilities

The Technician Service is responsible for:

* Technician work order retrieval
* Technician assignment verification
* Work order status updates
* Repair progress photo uploads
* Technician notification storage
* Notification polling
* Notification read-state management
* Internal communication with the Manager Service

It is **not responsible for creating work orders**. Work assignment and notification creation are initiated by the Manager Service through the internal API.

---

# 📄 License

This project is intended for educational and development purposes.

Add an appropriate license such as **MIT** or **Apache-2.0** if the repository will be publicly distributed.
