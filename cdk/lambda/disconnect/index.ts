import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, DeleteItemCommand, AttributeValue } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Max-Age': '86400'
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Disconnect event:', JSON.stringify(event, null, 2));

  if (!event.requestContext.connectionId) {
    console.error('No connectionId provided');
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'No connectionId provided' })
    };
  }

  try {
    const deleteParams = {
      TableName: process.env.CONNECTIONS_TABLE!,
      Key: {
        connectionId: { S: event.requestContext.connectionId }
      } as Record<string, AttributeValue>
    };

    console.log('Removing connection:', deleteParams);
    await dynamoClient.send(new DeleteItemCommand(deleteParams));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Disconnected successfully' })
    };
  } catch (error) {
    console.error('Error disconnecting:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: 'Failed to disconnect',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
