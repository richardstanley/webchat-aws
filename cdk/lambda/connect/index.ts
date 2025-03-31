import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand, AttributeValue } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Connect event:', JSON.stringify(event, null, 2));

  // Log the entire request context
  console.log('Request context:', JSON.stringify(event.requestContext, null, 2));

  if (!event.requestContext.connectionId) {
    console.error('No connectionId provided in request context');
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'No connectionId provided' })
    };
  }

  try {
    const timestamp = Date.now();
    const putParams = {
      TableName: process.env.CONNECTIONS_TABLE!,
      Item: {
        connectionId: { S: event.requestContext.connectionId },
        timestamp: { N: timestamp.toString() },
        connectedAt: { S: new Date(timestamp).toISOString() },
        requestContext: { S: JSON.stringify(event.requestContext) }
      } as Record<string, AttributeValue>
    };

    console.log('Storing connection with params:', JSON.stringify(putParams, null, 2));
    await dynamoClient.send(new PutItemCommand(putParams));
    console.log('Successfully stored connection in DynamoDB');

    const response = {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: 'Connected successfully',
        connectionId: event.requestContext.connectionId,
        timestamp
      })
    };

    console.log('Returning response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Error in connect handler:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: 'Failed to connect',
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionId: event.requestContext.connectionId
      })
    };
  }
};
