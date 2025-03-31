# AI Web Chat - Phase 2 Architecture (Bedrock Integration)

## System Architecture Diagram

```mermaid
graph TD
    Client[Web Client] -->|WebSocket Connection| APIGateway[API Gateway WebSocket API]
    APIGateway -->|Route| ConnectHandler[Connect Lambda]
    APIGateway -->|Route| DisconnectHandler[Disconnect Lambda]
    APIGateway -->|Route| DefaultHandler[Default Lambda]
    APIGateway -->|Route| SendMessageHandler[Send Message Lambda]
    APIGateway -->|Route| FileUploadHandler[File Upload Lambda]
    
    ConnectHandler -->|Store Connection ID| DynamoDB[(DynamoDB Connections Table)]
    DisconnectHandler -->|Remove Connection ID| DynamoDB
    SendMessageHandler -->|Broadcast Message| APIGateway
    SendMessageHandler -->|Process with Bedrock| BedrockAgent[Bedrock Agent]
    FileUploadHandler -->|Store Files| S3Bucket[(S3 Bucket)]
    BedrockAgent -->|Access Files| S3Bucket
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant Client
    participant APIGateway
    participant Lambda
    participant DynamoDB
    participant BedrockAgent
    participant S3Bucket

    %% Connection Flow
    Client->>APIGateway: WebSocket Connect
    APIGateway->>Lambda: $connect Route
    Lambda->>DynamoDB: Store Connection ID
    Lambda-->>APIGateway: Connection Success
    APIGateway-->>Client: Connection Established

    %% Message Flow with Bedrock
    Client->>APIGateway: Send Message
    APIGateway->>Lambda: sendMessage Route
    Lambda->>BedrockAgent: Process Message
    BedrockAgent->>S3Bucket: Access Context Files
    S3Bucket-->>BedrockAgent: File Content
    BedrockAgent-->>Lambda: AI Response
    Lambda->>DynamoDB: Get All Connection IDs
    DynamoDB-->>Lambda: Connection IDs
    Lambda->>APIGateway: Broadcast Message
    APIGateway-->>Client: Message Received

    %% File Upload Flow
    Client->>APIGateway: Upload File
    APIGateway->>Lambda: fileUpload Route
    Lambda->>S3Bucket: Store File
    S3Bucket-->>Lambda: Upload Success
    Lambda-->>APIGateway: File Uploaded
    APIGateway-->>Client: Upload Confirmation

    %% Disconnection Flow
    Client->>APIGateway: WebSocket Disconnect
    APIGateway->>Lambda: $disconnect Route
    Lambda->>DynamoDB: Remove Connection ID
    Lambda-->>APIGateway: Disconnection Success
    APIGateway-->>Client: Connection Closed
```

## Execution Tasks

### 1. Bedrock Agent Setup
- [ ] Create Bedrock agent with Nova model
- [ ] Configure agent parameters:
  - [ ] Temperature
  - [ ] Max tokens
  - [ ] Context window
- [ ] Set up agent permissions
- [ ] Test agent configuration

### 2. S3 Bucket Setup
- [ ] Create S3 bucket construct
- [ ] Configure bucket settings:
  - [ ] CORS configuration
  - [ ] Lifecycle policies
  - [ ] Encryption
- [ ] Set up bucket permissions
- [ ] Test bucket creation

### 3. File Upload Lambda Setup
- [ ] Create file upload Lambda function
- [ ] Configure function settings:
  - [ ] Memory allocation
  - [ ] Timeout
  - [ ] Environment variables
- [ ] Set up S3 permissions
- [ ] Test function creation

### 4. WebSocket API Updates
- [ ] Add file upload route
- [ ] Configure route integration
- [ ] Update API permissions
- [ ] Test new route

### 5. Message Handler Updates
- [ ] Modify sendMessage handler:
  - [ ] Add Bedrock integration
  - [ ] Handle AI responses
  - [ ] Manage context
- [ ] Update error handling
- [ ] Test message flow

### 6. IAM and Security Updates
- [ ] Create Bedrock access role
- [ ] Set up S3 access permissions
- [ ] Configure Lambda permissions
- [ ] Test security setup

### 7. Client Updates
- [ ] Add file upload UI
- [ ] Implement file handling
- [ ] Update message display
- [ ] Test client functionality

### 8. Testing Setup
- [ ] Create test files
- [ ] Test file uploads
- [ ] Test AI responses
- [ ] Test context management
- [ ] Test error scenarios

### 9. Documentation
- [ ] Update API documentation
- [ ] Document file handling
- [ ] Document AI integration
- [ ] Create troubleshooting guide

## Next Steps

1. Set up Bedrock agent with Nova model
2. Create S3 bucket for file storage
3. Implement file upload functionality
4. Update message handling with AI integration
5. Test the complete system

## Dependencies

- AWS Bedrock
- Amazon S3
- AWS CDK
- TypeScript
- AWS SDK
- Node.js
- AWS CLI (configured with appropriate credentials)

## File Structure

```
webchat-aws/                      # Root directory
├── cdk/                         # CDK project directory
│   ├── bin/                    # CDK app entry point
│   │   └── cdk.ts             # Main CDK app file
│   ├── lib/                    # Stack definitions
│   │   ├── websocket-stack.ts  # Main stack
│   │   └── constructs/        # Reusable constructs
│   │       ├── websocket-api.ts
│   │       ├── lambda-functions.ts
│   │       ├── bedrock-agent.ts
│   │       └── s3-bucket.ts
│   ├── lambda/                 # Lambda function code
│   │   ├── connect/
│   │   │   └── index.ts
│   │   ├── disconnect/
│   │   │   └── index.ts
│   │   ├── default/
│   │   │   └── index.ts
│   │   ├── sendMessage/
│   │   │   └── index.ts
│   │   └── fileUpload/
│   │       └── index.ts
│   ├── cdk.json               # CDK configuration
│   ├── package.json           # CDK project dependencies
│   └── tsconfig.json          # TypeScript configuration
├── test-client/               # Test client
│   ├── index.html            # Client interface
│   ├── server.js             # Test server
│   └── package.json          # Client dependencies
├── AI web chat phase 1.md     # Phase 1 documentation
├── AI web chat phase 2.md     # Phase 2 documentation
└── README.md                  # Project README
```

## Implementation Notes

1. **Bedrock Agent Configuration**
   - Use Nova model for optimal performance
   - Configure appropriate context window
   - Set up proper error handling
   - Implement rate limiting

2. **File Handling**
   - Implement file size limits
   - Add file type validation
   - Set up proper error handling
   - Configure S3 lifecycle policies

3. **Security Considerations**
   - Implement proper file access controls
   - Set up secure file upload
   - Configure CORS properly
   - Implement proper error handling

4. **Performance Optimization**
   - Implement caching where appropriate
   - Optimize file handling
   - Configure appropriate timeouts
   - Set up monitoring

## Next Steps

1. Initialize Bedrock agent setup
2. Create S3 bucket infrastructure
3. Implement file upload functionality
4. Update message handling with AI
5. Test the complete system 