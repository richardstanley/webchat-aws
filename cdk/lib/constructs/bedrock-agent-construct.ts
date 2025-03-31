import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface BedrockAgentConstructProps {
  agentName: string;
  agentDescription: string;
  agentRole: iam.IRole;
}

export class BedrockAgentConstruct extends Construct {
  public readonly agent: bedrock.CfnAgent;

  constructor(scope: Construct, id: string, props: BedrockAgentConstructProps) {
    super(scope, id);

    // Create Bedrock agent
    this.agent = new bedrock.CfnAgent(this, 'Agent', {
      agentName: props.agentName,
      description: props.agentDescription,
      agentResourceRoleArn: props.agentRole.roleArn,
      instruction: `You are an AI assistant for a web chat application. Your role is to:
1. Help users with their questions and tasks
2. Process and understand context from uploaded files
3. Provide clear and concise responses
4. Maintain a conversational tone
5. Handle errors gracefully

When processing messages:
- Consider any file context provided
- Keep responses concise and relevant
- If you need more information, ask clarifying questions
- If you encounter errors, explain them clearly to the user`,
      foundationModel: 'amazon.nova-20240229-v1:0',
      idleSessionTtlInSeconds: 1800,
      tags: {
        Project: 'WebChat',
        Environment: props.agentDescription
      }
    });
  }
} 