import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { BedrockAgentConstruct } from './constructs/bedrock-agent-construct';
import { S3BucketConstruct } from './constructs/s3-bucket-construct';

export class MainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB table for WebSocket connections
    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
    });

    // Create WebSocket API
    const webSocketApi = new apigatewayv2.WebSocketApi(this, 'WebSocketApi', {
      routeSelectionExpression: '$request.body.action',
      connectRouteOptions: { integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('ConnectIntegration', new lambda.Function(this, 'ConnectFunction', {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset('lambda/connect'),
        environment: {
          CONNECTIONS_TABLE: connectionsTable.tableName
        },
        initialPolicy: [
          new iam.PolicyStatement({
            actions: ['dynamodb:PutItem'],
            resources: [connectionsTable.tableArn]
          })
        ]
      })) },
      disconnectRouteOptions: { integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('DisconnectIntegration', new lambda.Function(this, 'DisconnectFunction', {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset('lambda/disconnect'),
        environment: {
          CONNECTIONS_TABLE: connectionsTable.tableName
        },
        initialPolicy: [
          new iam.PolicyStatement({
            actions: ['dynamodb:DeleteItem'],
            resources: [connectionsTable.tableArn]
          })
        ]
      })) },
      defaultRouteOptions: { integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('DefaultIntegration', new lambda.Function(this, 'DefaultFunction', {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset('lambda/default')
      })) }
    });

    // Create WebSocket Stage
    const stage = new apigatewayv2.WebSocketStage(this, 'WebSocketStage', {
      webSocketApi,
      stageName: 'prod',
      autoDeploy: true
    });

    // Create Bedrock agent
    const bedrockAgent = new BedrockAgentConstruct(this, 'BedrockAgent', {
      agentName: 'WebChatAgent',
      agentDescription: 'AI agent for web chat application',
      agentRole: new iam.Role(this, 'BedrockAgentRole', {
        assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess')
        ]
      })
    });

    // Create S3 bucket for file uploads
    const s3Bucket = new S3BucketConstruct(this, 'FileUploadBucket', {
      bucketName: `webchat-files-${this.account}-${this.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // Create file upload Lambda function
    const fileUploadFunction = new lambda.Function(this, 'FileUploadFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/dist/fileUpload'),
      environment: {
        S3_BUCKET_NAME: s3Bucket.bucket.bucketName
      },
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ['s3:PutObject'],
          resources: [s3Bucket.bucket.arnForObjects('*')]
        })
      ]
    });

    // Create send message Lambda function
    const sendMessageFunction = new lambda.Function(this, 'SendMessageFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/dist/sendMessage'),
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName,
        BEDROCK_AGENT_ID: bedrockAgent.agent.attrAgentId,
        S3_BUCKET_NAME: s3Bucket.bucket.bucketName
      },
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ['dynamodb:Scan'],
          resources: [connectionsTable.tableArn]
        }),
        new iam.PolicyStatement({
          actions: ['bedrock:InvokeModel'],
          resources: [bedrockAgent.agent.attrAgentArn]
        }),
        new iam.PolicyStatement({
          actions: ['s3:GetObject'],
          resources: [s3Bucket.bucket.arnForObjects('*')]
        })
      ]
    });

    // Add send message route to WebSocket API
    webSocketApi.addRoute('sendMessage', {
      integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('SendMessageIntegration', sendMessageFunction)
    });

    // Add file upload route to WebSocket API
    webSocketApi.addRoute('uploadFile', {
      integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('FileUploadIntegration', fileUploadFunction)
    });

    // Output the WebSocket URL
    new cdk.CfnOutput(this, 'WebSocketURL', {
      value: stage.url
    });
  }
} 