import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface FileUploadLambdaProps {
  /**
   * The S3 bucket to store files
   */
  bucket: s3.Bucket;
  
  /**
   * The maximum file size allowed (in bytes)
   */
  maxFileSize?: number;
  
  /**
   * The allowed file types
   */
  allowedFileTypes?: string[];
}

export class FileUploadLambda extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: FileUploadLambdaProps) {
    super(scope, id);

    // Create Lambda function
    this.function = new lambda.Function(this, 'FileUploadFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/fileUpload'),
      environment: {
        S3_BUCKET_NAME: props.bucket.bucketName,
        MAX_FILE_SIZE: props.maxFileSize?.toString() || '10485760', // 10MB default
        ALLOWED_FILE_TYPES: props.allowedFileTypes?.join(',') || 'pdf,txt,doc,docx'
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256
    });

    // Grant S3 permissions
    props.bucket.grantReadWrite(this.function);

    // Add CORS headers to the response
    this.function.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: ['execute-api:ManageConnections'],
      resources: ['*']
    }));

    // Output the function ARN
    new cdk.CfnOutput(this, 'FileUploadFunctionArn', {
      value: this.function.functionArn,
      description: 'ARN of the file upload Lambda function'
    });
  }
} 