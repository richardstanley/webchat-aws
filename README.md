# WebChat AWS

A real-time WebSocket chat application built with AWS services, featuring AI integration capabilities.

## Project Overview

This project implements a WebSocket-based chat application using AWS services. The application is built in two phases:

### Phase 1 (Completed)
- Basic WebSocket chat functionality
- Real-time message broadcasting
- Connection management
- AWS infrastructure using CDK

### Phase 2 (In Progress)
- AWS Bedrock integration for AI capabilities
- File upload and storage
- Enhanced message handling
- Extended testing and documentation

## Architecture

The application uses the following AWS services:
- API Gateway (WebSocket API)
- Lambda Functions
- DynamoDB
- S3 (Phase 2)
- AWS Bedrock (Phase 2)

## Prerequisites

- Node.js (v14 or later)
- AWS CLI configured with appropriate credentials
- AWS CDK CLI
- TypeScript

## Project Structure

```
webchat-aws/                      # Root directory
├── cdk/                         # CDK project directory
│   ├── bin/                    # CDK app entry point
│   ├── lib/                    # Stack definitions
│   ├── lambda/                 # Lambda function code
│   └── test/                   # CDK tests
├── test-client/                # Test client application
└── docs/                       # Project documentation
```

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd webchat-aws
   ```

2. Install dependencies:
   ```bash
   cd cdk
   npm install
   ```

3. Deploy the infrastructure:
   ```bash
   cdk deploy
   ```

4. Start the test client:
   ```bash
   cd ../test-client
   npm install
   npm start
   ```

## Development

### Adding New Features
1. Create a new branch for your feature
2. Make your changes
3. Test locally
4. Submit a pull request

### Testing
- Unit tests: `npm test`
- Integration tests: `npm run test:integration`
- End-to-end tests: `npm run test:e2e`

## Deployment

The application is deployed using AWS CDK. To deploy:

1. Configure AWS credentials
2. Run `cdk deploy` in the `cdk` directory
3. Verify the deployment in AWS Console

## Documentation

- [Phase 1 Architecture](AI%20web%20chat%20phase%201.md)
- [Phase 2 Architecture](AI%20web%20chat%20phase%202.md)
- [API Documentation](docs/api.md)
- [Deployment Guide](docs/deployment.md)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
