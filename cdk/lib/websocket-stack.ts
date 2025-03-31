import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { BedrockAgent } from './constructs/bedrock-agent';
import { S3BucketConstruct } from './constructs/s3-bucket-construct';

export class WebSocketStack extends cdk.Stack {
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
      connectRouteOptions: { 
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('ConnectIntegration', new lambda.Function(this, 'ConnectFunction', {
          runtime: lambda.Runtime.NODEJS_18_X,
          handler: 'index.handler',
          code: lambda.Code.fromAsset('lambda/dist/connect'),
          environment: {
            CONNECTIONS_TABLE: connectionsTable.tableName
          },
          initialPolicy: [
            new iam.PolicyStatement({
              actions: ['dynamodb:PutItem'],
              resources: [connectionsTable.tableArn]
            }),
            new iam.PolicyStatement({
              actions: ['execute-api:ManageConnections', 'execute-api:Invoke'],
              resources: [`arn:aws:execute-api:${this.region}:${this.account}:*/*`]
            })
          ]
        }))
      },
      disconnectRouteOptions: { 
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('DisconnectIntegration', new lambda.Function(this, 'DisconnectFunction', {
          runtime: lambda.Runtime.NODEJS_18_X,
          handler: 'index.handler',
          code: lambda.Code.fromAsset('lambda/dist/disconnect'),
          environment: {
            CONNECTIONS_TABLE: connectionsTable.tableName
          },
          initialPolicy: [
            new iam.PolicyStatement({
              actions: ['dynamodb:DeleteItem'],
              resources: [connectionsTable.tableArn]
            }),
            new iam.PolicyStatement({
              actions: ['execute-api:ManageConnections', 'execute-api:Invoke'],
              resources: [`arn:aws:execute-api:${this.region}:${this.account}:*/*`]
            })
          ]
        }))
      },
      defaultRouteOptions: { 
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('DefaultIntegration', new lambda.Function(this, 'DefaultFunction', {
          runtime: lambda.Runtime.NODEJS_18_X,
          handler: 'index.handler',
          code: lambda.Code.fromAsset('lambda/dist/default'),
          initialPolicy: [
            new iam.PolicyStatement({
              actions: ['execute-api:ManageConnections', 'execute-api:Invoke'],
              resources: [`arn:aws:execute-api:${this.region}:${this.account}:*/*`]
            })
          ]
        }))
      }
    });

    // Create CloudWatch Logs role for API Gateway
    const apiGatewayLogsRole = new iam.Role(this, 'ApiGatewayLogsRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs')
      ]
    });

    // Create CloudWatch log group for API access logging
    const logGroup = new logs.LogGroup(this, 'WebSocketApiLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Grant API Gateway permission to write to the log group
    logGroup.grantWrite(apiGatewayLogsRole);

    // Create WebSocket Stage
    const stage = new apigatewayv2.CfnStage(this, 'WebSocketStage', {
      apiId: webSocketApi.apiId,
      stageName: 'prod',
      autoDeploy: true,
      accessLogSettings: {
        destinationArn: logGroup.logGroupArn,
        format: JSON.stringify({
          requestId: '$context.requestId',
          ip: '$context.identity.sourceIp',
          caller: '$context.identity.caller',
          user: '$context.identity.user',
          requestTime: '$context.requestTime',
          eventType: '$context.eventType',
          routeKey: '$context.routeKey',
          status: '$context.status',
          connectionId: '$context.connectionId',
          messageId: '$context.messageId',
          integrationError: '$context.integrationErrorMessage'
        })
      },
      defaultRouteSettings: {
        dataTraceEnabled: true,
        detailedMetricsEnabled: true,
        loggingLevel: 'INFO'
      }
    });

    // Update API Gateway account settings with CloudWatch Logs role
    new apigateway.CfnAccount(this, 'ApiGatewayAccount', {
      cloudWatchRoleArn: apiGatewayLogsRole.roleArn
    });

    // Create Bedrock agent
    const bedrockAgent = new BedrockAgent(this, 'BedrockAgent', {
      agentName: 'WebChatAgent',
      agentDescription: 'AI agent for web chat application',
      environment: this.stackName
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
        }),
        new iam.PolicyStatement({
          actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
          resources: ['*']
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
      value: `wss://${webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${stage.stageName}`
    });
  }
} 