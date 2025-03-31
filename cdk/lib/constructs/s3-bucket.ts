import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface S3BucketProps {
  /**
   * The name of the S3 bucket
   */
  bucketName: string;
  
  /**
   * Whether to enable CORS
   */
  enableCors?: boolean;
  
  /**
   * The maximum file size allowed (in bytes)
   */
  maxFileSize?: number;
  
  /**
   * The allowed file types
   */
  allowedFileTypes?: string[];
}

export class S3BucketConstruct extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly deployment: s3deploy.BucketDeployment;

  constructor(scope: Construct, id: string, props: S3BucketProps) {
    super(scope, id);

    // Create S3 bucket
    this.bucket = new s3.Bucket(this, 'FileStorageBucket', {
      bucketName: props.bucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      cors: props.enableCors ? [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT
          ],
          allowedOrigins: ['*'], // TODO: Restrict to specific origins
          allowedHeaders: ['*'],
          maxAge: 3000
        }
      ] : undefined,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(30),
          noncurrentVersionExpiration: cdk.Duration.days(7)
        }
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      versioned: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED
    });

    // Add bucket policy for file size and type restrictions
    if (props.maxFileSize || props.allowedFileTypes) {
      this.bucket.addToResourcePolicy(new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.DENY,
        principals: [new cdk.aws_iam.AnyPrincipal()],
        actions: ['s3:PutObject'],
        resources: [this.bucket.arnForObjects('*')],
        conditions: {
          ...(props.maxFileSize && {
            'Content-Length-Range': [0, props.maxFileSize]
          }),
          ...(props.allowedFileTypes && {
            'StringNotLike': {
              's3:prefix': props.allowedFileTypes.map(type => `*.${type}`)
            }
          })
        }
      }));
    }

    // Output the bucket name and ARN
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'Name of the S3 bucket'
    });

    new cdk.CfnOutput(this, 'BucketArn', {
      value: this.bucket.bucketArn,
      description: 'ARN of the S3 bucket'
    });
  }
} 