# Project Structure Documentation

## 📁 Complete Folder Structure

```
omeeba-backend/
│
├── src/                          # Source code
│   ├── config/                   # Configuration files
│   │   ├── database.js          # MongoDB connection setup
│   │   └── env.js                # Environment variables loader
│   │
│   ├── controllers/             # Request handlers (MVC - Controller)
│   │   ├── auth.controller.js   # Authentication controllers
│   │   ├── user.controller.js   # User controllers
│   │   ├── post.controller.js   # Post controllers
│   │   └── index.js             # Controller exports
│   │
│   ├── services/                 # Business logic layer
│   │   ├── auth.service.js      # Authentication service
│   │   ├── user.service.js      # User service
│   │   ├── post.service.js      # Post service
│   │   └── index.js             # Service exports
│   │
│   ├── routes/                   # API route definitions
│   │   ├── auth.routes.js       # Authentication routes
│   │   ├── user.routes.js       # User routes
│   │   ├── post.routes.js       # Post routes
│   │   └── index.js             # Route aggregator
│   │
│   ├── middleware/              # Custom middleware
│   │   ├── auth.js              # JWT authentication
│   │   ├── errorHandler.js      # Global error handler
│   │   └── validator.js        # Request validation
│   │
│   ├── models/                   # Mongoose models
│   │   ├── users/               # User models
│   │   │   ├── User.js
│   │   │   ├── UserFollower.js
│   │   │   └── UserAudience.js
│   │   ├── content/             # Content models
│   │   │   ├── Post.js
│   │   │   ├── WritePost.js
│   │   │   ├── ZealPost.js
│   │   │   └── Poll.js
│   │   ├── comments/           # Comment models
│   │   ├── interactions/        # Interaction models
│   │   ├── chat/               # Chat models
│   │   ├── subscriptions/      # Subscription models
│   │   ├── notifications/      # Notification models
│   │   ├── music/              # Music models
│   │   ├── enums.js            # Enum definitions
│   │   ├── index.js            # Model exports
│   │   └── utils/              # Model utilities
│   │
│   ├── utils/                   # Utility functions
│   │   ├── logger.js           # Winston logger
│   │   ├── response.js         # Response helpers
│   │   ├── pagination.js       # Pagination helpers
│   │   └── helpers.js          # General helpers
│   │
│   ├── constants/              # Application constants
│   │   └── index.js            # All constants
│   │
│   ├── validators/             # Request validators
│   │   ├── auth.validator.js  # Auth validators
│   │   ├── user.validator.js  # User validators
│   │   └── index.js           # Validator exports
│   │
│   ├── app.js                  # Express app configuration
│   └── server.js               # Server entry point
│
├── tests/                      # Test files
│   ├── unit/                   # Unit tests
│   │   ├── controllers/
│   │   ├── services/
│   │   └── utils/
│   ├── integration/            # Integration tests
│   │   ├── auth.test.js
│   │   └── api.test.js
│   └── setup.js               # Test configuration
│
├── docs/                      # Documentation
│   ├── API.md                 # API documentation
│   ├── DEPLOYMENT.md          # Deployment guide
│   └── PROJECT_STRUCTURE.md  # This file
│
├── logs/                      # Log files (gitignored)
│   ├── combined.log
│   └── error.log
│
├── .env.example              # Environment variables template
├── .env                      # Environment variables (gitignored)
├── .gitignore               # Git ignore rules
├── .eslintrc.json           # ESLint configuration
├── .prettierrc              # Prettier configuration
├── jest.config.js           # Jest test configuration
├── package.json            # Dependencies and scripts
└── README.md               # Main documentation
```

## 🏗️ Architecture Layers

### 1. **Routes Layer** (`src/routes/`)
- Define API endpoints
- Map routes to controllers
- Apply middleware (auth, validation)

### 2. **Controllers Layer** (`src/controllers/`)
- Handle HTTP requests/responses
- Call services for business logic
- Return formatted responses

### 3. **Services Layer** (`src/services/`)
- Business logic implementation
- Database operations
- External API calls
- Data transformation

### 4. **Models Layer** (`src/models/`)
- Mongoose schemas
- Database models
- Model relationships

### 5. **Middleware Layer** (`src/middleware/`)
- Authentication
- Authorization
- Error handling
- Request validation

## 📝 File Naming Conventions

- **Controllers**: `*.controller.js`
- **Services**: `*.service.js`
- **Routes**: `*.routes.js`
- **Validators**: `*.validator.js`
- **Models**: `*.js` (PascalCase)
- **Utils**: `*.js` (camelCase)

## 🔄 Data Flow

```
Request → Routes → Middleware → Controllers → Services → Models → Database
                                                              ↓
Response ← Routes ← Controllers ← Services ← Models ← Database
```

## 📦 Module Organization

### Controllers
- One controller per resource
- Methods: `create`, `read`, `update`, `delete`, `list`

### Services
- Business logic separated from HTTP
- Reusable across different controllers
- Handle complex operations

### Models
- Organized by domain (users, content, etc.)
- Each model in its own file
- Centralized exports in `index.js`

## 🎯 Best Practices

1. **Separation of Concerns**: Each layer has a specific responsibility
2. **DRY Principle**: Reusable utilities and services
3. **Error Handling**: Centralized error handling middleware
4. **Validation**: Request validation before processing
5. **Security**: Authentication and authorization middleware
6. **Logging**: Comprehensive logging for debugging
7. **Testing**: Unit and integration tests

## 🚀 Getting Started

1. Copy `.env.example` to `.env`
2. Install dependencies: `npm install`
3. Start development: `npm run dev`
4. Run tests: `npm test`

