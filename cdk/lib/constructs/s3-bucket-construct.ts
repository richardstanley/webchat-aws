import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface S3BucketConstructProps {
  bucketName: string;
  removalPolicy?: cdk.RemovalPolicy;
  autoDeleteObjects?: boolean;
}

export class S3BucketConstruct extends Construct {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: S3BucketConstructProps) {
    super(scope, id);

    // Create S3 bucket
    this.bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: props.bucketName,
      removalPolicy: props.removalPolicy || cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: props.autoDeleteObjects || false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*']
        }
      ],
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(7)
        }
      ]
    });
  }
} 