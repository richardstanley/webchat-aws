import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Validate request
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No file data provided' })
      };
    }

    // Parse the request body
    const body = JSON.parse(event.body);
    const { fileName, fileType, fileData } = body;

    if (!fileName || !fileType || !fileData) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Validate file size
    const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '10485760');
    const fileSize = Buffer.from(fileData, 'base64').length;
    if (fileSize > maxFileSize) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'File size exceeds maximum allowed size' })
      };
    }

    // Validate file type
    const allowedFileTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,txt,doc,docx').split(',');
    if (!allowedFileTypes.includes(fileType.toLowerCase())) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'File type not allowed' })
      };
    }

    // Generate unique file name
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${fileName}`;

    // Upload file to S3
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: uniqueFileName,
      Body: Buffer.from(fileData, 'base64'),
      ContentType: `application/${fileType}`,
      Metadata: {
        originalName: fileName,
        fileType,
        uploadedAt: new Date().toISOString()
      }
    });

    await s3Client.send(command);

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        message: 'File uploaded successfully',
        fileName: uniqueFileName,
        fileSize,
        fileType
      })
    };

  } catch (error) {
    console.error('Error processing file upload:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ error: 'Failed to process file upload' })
    };
  }
}; 