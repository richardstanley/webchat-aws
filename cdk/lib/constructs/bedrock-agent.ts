import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';

export interface BedrockAgentProps {
  /**
   * The name of the Bedrock agent
   */
  agentName: string;
  
  /**
   * The description of the Bedrock agent
   */
  agentDescription: string;
  
  /**
   * The environment of the Bedrock agent
   */
  environment: string;
}

export class BedrockAgent extends Construct {
  public readonly agent: bedrock.CfnAgent;
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: BedrockAgentProps) {
    super(scope, id);

    // Create IAM role for the Bedrock agent
    this.role = new iam.Role(this, 'BedrockAgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess')
      ]
    });

    // Create Bedrock agent
    this.agent = new bedrock.CfnAgent(this, 'Agent', {
      agentName: props.agentName,
      description: props.agentDescription,
      agentResourceRoleArn: this.role.roleArn,
      instruction: 'You are a helpful AI assistant that can help users with their questions and tasks.',
      foundationModel: 'amazon.nova-20240229-v1:0',
      idleSessionTtlInSeconds: 1800,
      tags: {
        Environment: props.environment
      }
    });

    // Output the agent ARN
    new cdk.CfnOutput(this, 'BedrockAgentArn', {
      value: this.agent.attrAgentArn,
      description: 'ARN of the Bedrock agent'
    });
  }
} 