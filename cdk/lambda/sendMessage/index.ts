import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const bedrockClient = new BedrockRuntimeClient({});
const s3Client = new S3Client({});

// Initialize API Gateway client with the correct endpoint
function getApiGatewayClient(event: APIGatewayProxyEvent): ApiGatewayManagementApiClient {
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  const endpoint = `https://${domain}/${stage}`;
  console.log('Creating API Gateway client with endpoint:', endpoint);
  return new ApiGatewayManagementApiClient({
    endpoint,
    maxAttempts: 3
  });
}

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || '';
const BUCKET_NAME = process.env.BUCKET_NAME || '';
const BEDROCK_AGENT_ID = process.env.BEDROCK_AGENT_ID || '';

interface FileUploadState {
    fileName: string;
    fileType: string;
    fileSize: number;
    totalChunks: number;
    receivedChunks: number;
    chunks: { [key: number]: string };
}

interface ConnectionItem {
    connectionId: string;
}

const fileUploadStates: { [key: string]: FileUploadState } = {};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body || '{}');
    const connectionId = event.requestContext.connectionId;
    console.log('Connection ID:', connectionId);
    
    const apiGatewayClient = getApiGatewayClient(event);
    console.log('API Gateway client created');

    if (!connectionId) {
      console.error('Missing connectionId in event');
      throw new Error('Missing connectionId');
    }

    // Handle file upload actions
    if (body.action === 'startFileUpload') {
      console.log('Starting file upload:', body);
      const { fileName, fileType, fileSize, totalChunks } = body;
      fileUploadStates[fileName] = {
        fileName,
        fileType,
        fileSize,
        totalChunks,
        receivedChunks: 0,
        chunks: {}
      };
      await sendToConnection(connectionId, {
        type: 'fileUpload',
        message: `Starting upload of ${fileName}`
      }, apiGatewayClient);
      console.log('File upload started successfully');
      return { 
        statusCode: 200,
        body: JSON.stringify({ message: 'Upload started' })
      };
    }

    if (body.action === 'uploadFileChunk') {
      const { fileName, chunkIndex, totalChunks, chunkData } = body;
      const state = fileUploadStates[fileName];
      
      if (!state) {
        throw new Error(`No upload state found for file ${fileName}`);
      }

      state.chunks[chunkIndex] = chunkData;
      state.receivedChunks++;

      await sendToConnection(connectionId, {
        type: 'fileUpload',
        message: `Received chunk ${chunkIndex + 1} of ${totalChunks} for ${fileName}`
      }, apiGatewayClient);

      return { 
        statusCode: 200,
        body: JSON.stringify({ message: 'Chunk received' })
      };
    }

    if (body.action === 'completeFileUpload') {
      const { fileName } = body;
      const state = fileUploadStates[fileName];
      
      if (!state) {
        throw new Error(`No upload state found for file ${fileName}`);
      }

      if (state.receivedChunks !== state.totalChunks) {
        throw new Error(`Incomplete file upload: received ${state.receivedChunks} of ${state.totalChunks} chunks`);
      }

      // Combine chunks and upload to S3
      const chunks = Array.from({ length: state.totalChunks }, (_, i) => state.chunks[i]);
      const fileData = Buffer.from(chunks.join(''), 'base64');

      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `uploads/${fileName}`,
        Body: fileData,
        ContentType: state.fileType
      }));

      // Clean up upload state
      delete fileUploadStates[fileName];

      await sendToConnection(connectionId, {
        type: 'fileUpload',
        message: `Successfully uploaded ${fileName}`
      }, apiGatewayClient);

      return { 
        statusCode: 200,
        body: JSON.stringify({ message: 'Upload completed' })
      };
    }

    // Handle regular chat messages
    if (!body.message) {
      throw new Error('Missing message');
    }

    // Get all connection IDs
    const scanResult = await docClient.send(new ScanCommand({
      TableName: CONNECTIONS_TABLE
    }));

    const connectionIds = (scanResult.Items as ConnectionItem[])?.map(item => item.connectionId) || [];

    // Send message to all connected clients
    for (const connId of connectionIds) {
      try {
        await sendToConnection(connId, {
          message: body.message,
          sender: connectionId === connId ? 'You' : 'Other'
        }, apiGatewayClient);
      } catch (error) {
        console.error(`Error sending to connection ${connId}:`, error);
        // Remove stale connections
        if (error instanceof Error && error.message.includes('GoneException')) {
          await removeStaleConnection(connId);
        }
      }
    }

    // Invoke Bedrock agent for AI response
    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: BEDROCK_AGENT_ID,
      body: JSON.stringify({
        inputText: body.message,
        sessionAttributes: {
          timestamp: new Date().toISOString(),
          messageType: 'chat'
        },
        context: {
          files: [] // TODO: Add file context when available
        }
      })
    }));

    const aiResponse = JSON.parse(new TextDecoder().decode(response.body));
    
    // Handle Bedrock response
    if (!aiResponse || !aiResponse.outputText) {
      throw new Error('Invalid response from Bedrock agent');
    }

    // Broadcast AI response to all clients
    for (const connId of connectionIds) {
      try {
        await sendToConnection(connId, {
          message: aiResponse.outputText,
          sender: 'AI',
          timestamp: new Date().toISOString()
        }, apiGatewayClient);
      } catch (error) {
        console.error(`Error sending AI response to connection ${connId}:`, error);
        if (error instanceof Error && error.message.includes('GoneException')) {
          await removeStaleConnection(connId);
        }
      }
    }

    return { 
      statusCode: 200,
      body: JSON.stringify({ message: 'Message processed' })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: error instanceof Error ? error.message : 'Internal server error'
      })
    };
  }
};

async function sendToConnection(connectionId: string, data: any, apiGatewayClient: ApiGatewayManagementApiClient) {
  try {
    console.log(`Sending message to connection ${connectionId}:`, data);
    await apiGatewayClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(data))
    }));
    console.log(`Successfully sent message to connection ${connectionId}`);
  } catch (error) {
    console.error(`Error sending message to connection ${connectionId}:`, error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    throw error;
  }
}

async function removeStaleConnection(connectionId: string) {
  try {
    await docClient.send(new DeleteCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }));
    console.log(`Removed stale connection ${connectionId}`);
  } catch (error) {
    console.error(`Error removing stale connection ${connectionId}:`, error);
  }
}
