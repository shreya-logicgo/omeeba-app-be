# Omeeba Backend API

Enterprise-level backend API for Omeeba Social Media Platform built with Node.js, Express, and MongoDB.

## 📁 Project Structure

```
omeeba-backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── database.js      # MongoDB connection
│   │   └── env.js           # Environment variables
│   ├── controllers/         # Request handlers
│   ├── services/            # Business logic
│   ├── routes/              # API routes
│   ├── middleware/          # Custom middleware
│   │   ├── auth.js         # Authentication
│   │   ├── errorHandler.js # Error handling
│   │   └── validator.js    # Request validation
│   ├── models/             # Mongoose models
│   │   ├── users/
│   │   ├── content/
│   │   ├── comments/
│   │   ├── interactions/
│   │   ├── chat/
│   │   ├── subscriptions/
│   │   └── ...
│   ├── utils/              # Utility functions
│   │   ├── logger.js       # Winston logger
│   │   ├── response.js     # Response helpers
│   │   └── pagination.js  # Pagination helpers
│   ├── constants/          # Constants
│   ├── validators/         # Request validators
│   ├── app.js              # Express app setup
│   └── server.js           # Server entry point
├── tests/                  # Test files
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── setup.js           # Test setup
├── docs/                   # Documentation
├── logs/                   # Log files
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore rules
├── jest.config.js         # Jest configuration
├── package.json           # Dependencies
└── README.md             # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB >= 5.0.0

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd Omeeba
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server
```bash
npm run dev
```

## 📝 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

- **Database**: MongoDB connection string
- **JWT**: Secret keys for authentication
- **File Upload**: Cloudinary or local storage
- **Email**: SMTP configuration

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Health Check
```
GET /health
GET /api/health
```

## 🏗️ Architecture

### MVC Pattern
- **Models**: Database schemas (Mongoose)
- **Controllers**: Request handlers
- **Services**: Business logic layer
- **Routes**: API endpoint definitions

### Middleware Stack
1. Security (Helmet, CORS)
2. Body parsing
3. Compression
4. Logging (Morgan)
5. Authentication
6. Validation
7. Error handling

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/unit/user.test.js
```

## 📦 Dependencies

### Production
- **express** - Web framework
- **mongoose** - MongoDB ODM
- **jsonwebtoken** - JWT authentication
- **bcryptjs** - Password hashing
- **express-validator** - Request validation
- **winston** - Logging
- **helmet** - Security headers
- **cors** - CORS middleware

### Development
- **nodemon** - Auto-reload
- **jest** - Testing framework
- **eslint** - Code linting
- **prettier** - Code formatting

## 🔒 Security Features

- Helmet.js for security headers
- CORS configuration
- JWT authentication
- Password hashing with bcrypt
- Input validation
- SQL injection prevention (MongoDB)
- XSS protection

## 📊 Logging

Logs are stored in `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Write tests
4. Run linting and tests
5. Submit a pull request

## 📄 License

ISC

## 👥 Team

Omeeba Development Team

---

**Built with ❤️ for Omeeba Social Media Platform**
