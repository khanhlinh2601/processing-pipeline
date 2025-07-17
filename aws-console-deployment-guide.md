# Document Processing Pipeline: AWS Console Deployment Guide

This guide provides step-by-step instructions for deploying the Document Processing Pipeline on AWS using the AWS Console (without CDK or Terraform).

## Prerequisites

- AWS account with appropriate permissions
- Docker installed locally
- AWS CLI configured with appropriate credentials
- Docker image built (`document-processing-pipeline:latest`)

## Step 1: Create S3 Bucket for Documents

1. Go to the [S3 Console](https://console.aws.amazon.com/s3/)
2. Click "Create bucket"
3. Enter a globally unique bucket name (e.g., `document-processing-docs-[your-account-id]`)
4. Select your preferred region
5. Enable versioning under "Bucket Versioning"
6. Leave other settings as default
7. Click "Create bucket"

## Step 2: Create SQS Queues

### Main Processing Queue
1. Go to the [SQS Console](https://console.aws.amazon.com/sqs/)
2. Click "Create queue"
3. Select "Standard Queue"
4. Enter name: `document-processing-queue`
5. Configure settings:
   - Default visibility timeout: 300 seconds (5 minutes)
   - Message retention period: 4 days
   - Maximum message size: 256 KB
6. Under "Dead-letter queue", click "Enable"
   - Click "Create new queue" and name it `document-processing-dlq`
   - Set "Maximum receives" to 5
7. Click "Create queue"

### Manual Review Queue
1. Click "Create queue" again
2. Select "Standard Queue"
3. Enter name: `manual-review-queue`
4. Configure with similar settings as above
5. Create a dead-letter queue for it as well
6. Click "Create queue"

## Step 3: Create DynamoDB Tables

### Lineage Node Table
1. Go to the [DynamoDB Console](https://console.aws.amazon.com/dynamodb/)
2. Click "Create table"
3. Enter table name: `lineage_node`
4. Primary key: `node_id` (String)
5. Leave default settings
6. Click "Create"

### Lineage Relationship Table
1. Click "Create table" again
2. Enter table name: `lineage_relationship`
3. Primary key: `relationship_id` (String)
4. Leave default settings
5. Click "Create"

## Step 4: Set Up Aurora PostgreSQL Database

1. Go to the [RDS Console](https://console.aws.amazon.com/rds/)
2. Click "Create database"
3. Select "Standard create"
4. Choose "Amazon Aurora PostgreSQL-Compatible Edition"
5. Select latest version
6. Choose "Dev/Test" or "Production" template based on your needs
7. Configure settings:
   - DB cluster identifier: `document-processing-db`
   - Master username: Create a username
   - Master password: Create a secure password (save it!)
8. Under "Instance configuration":
   - Choose appropriate instance size (e.g., db.t3.medium for dev/test)
9. Under "Connectivity":
   - Create a new VPC or use existing one
   - Create a new security group or use existing one
   - Make sure "Publicly accessible" is set appropriately (No for production)
10. Under "Additional configuration":
    - Initial database name: `document_processing`
11. Click "Create database"

### Set Up Database Schema
1. Connect to your database using a PostgreSQL client
2. Run the following SQL scripts to create tables:

```sql
CREATE TABLE lineage_node (
    node_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_type VARCHAR(50) NOT NULL,
    node_name VARCHAR(255) NOT NULL,
    qualified_name VARCHAR(500) NOT NULL,
    metadata JSONB,
    job_id UUID NOT NULL,
    system TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lineage_relationship (
    relationship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node_id UUID NOT NULL REFERENCES lineage_node(node_id),
    target_node_id UUID NOT NULL REFERENCES lineage_node(node_id),
    relationship_type VARCHAR(100) NOT NULL,
    business_rule JSONB,
    source_meta JSONB,
    target_meta JSONB,
    confidence DECIMAL(3,2),
    is_verified BOOLEAN DEFAULT false,
    job_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE document_job (
    job_id UUID PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    bucket VARCHAR(255) NOT NULL,
    key VARCHAR(1024) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    timestamp VARCHAR(50) NOT NULL,
    original_name VARCHAR(255),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    textract_features JSONB,
    textract_job_id VARCHAR(255)
);
```

## Step 5: Set Up Bedrock Access

1. Go to the [Amazon Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. Click "Model access" in the left navigation
3. Click "Manage model access"
4. Request access to Claude or Titan models by selecting them
5. Click "Request model access"
6. Wait for approval (usually immediate for base models)
7. Note the model ID for your selected model (e.g., `anthropic.claude-v2`)

## Step 6: Create ECR Repository and Push Docker Image

1. Go to the [ECR Console](https://console.aws.amazon.com/ecr/)
2. Click "Create repository"
3. Enter repository name: `document-processing-pipeline`
4. Leave settings as default
5. Click "Create repository"
6. Click on your new repository
7. Click "View push commands"
8. Follow the commands shown to tag and push your Docker image

## Step 7: Create IAM Roles

### Task Execution Role
1. Go to the [IAM Console](https://console.aws.amazon.com/iam/)
2. Click "Roles" in the left navigation
3. Click "Create role"
4. Select "AWS service" as the trusted entity
5. Choose "Elastic Container Service" as the service
6. Select "Elastic Container Service Task" as the use case
7. Click "Next: Permissions"
8. Search for and attach the following policies:
   - `AmazonECR-FullAccess`
   - `CloudWatchLogsFullAccess`
9. Click "Next: Tags" (add optional tags)
10. Click "Next: Review"
11. Name the role: `document-processor-execution-role`
12. Click "Create role"

### Task Role
1. Click "Create role" again
2. Select "AWS service" as the trusted entity
3. Choose "Elastic Container Service" as the service
4. Select "Elastic Container Service Task" as the use case
5. Click "Next: Permissions"
6. Create and attach the following custom policies:
   - S3 access policy
   - SQS access policy
   - DynamoDB access policy
   - Bedrock access policy
   - RDS access policy
7. Example policy document:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::document-processing-docs-*/*",
                "arn:aws:s3:::document-processing-docs-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "sqs:SendMessage",
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes",
                "sqs:GetQueueUrl",
                "sqs:ChangeMessageVisibility"
            ],
            "Resource": [
                "arn:aws:sqs:*:*:document-processing-queue",
                "arn:aws:sqs:*:*:manual-review-queue"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan"
            ],
            "Resource": [
                "arn:aws:dynamodb:*:*:table/lineage_node",
                "arn:aws:dynamodb:*:*:table/lineage_relationship"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel"
            ],
            "Resource": "*"
        }
    ]
}
```

8. Click "Next: Tags" (add optional tags)
9. Click "Next: Review"
10. Name the role: `document-processor-task-role`
11. Click "Create role"

## Step 8: Create ECS Cluster

1. Go to the [ECS Console](https://console.aws.amazon.com/ecs/)
2. Click "Clusters" in the left navigation
3. Click "Create Cluster"
4. Enter cluster name: `document-processing-cluster`
5. Select "AWS Fargate (serverless)" for infrastructure
6. Leave other settings as default
7. Click "Create"

## Step 9: Create Task Definition

1. Go to "Task Definitions" in the left navigation
2. Click "Create new Task Definition"
3. Select "Fargate" for launch type
4. Click "Next step"
5. Enter task definition name: `document-processor-task`
6. Select task role: `document-processor-task-role`
7. Select task execution role: `document-processor-execution-role`
8. Select "1 vCPU" for Task CPU
9. Select "2 GB" for Task Memory
10. Click "Add container"
11. Configure container:
    - Container name: `document-processor`
    - Image URI: `[your-account-id].dkr.ecr.[your-region].amazonaws.com/document-processing-pipeline:latest`
    - Memory Limits: 1024 (soft limit)
    - Port mappings: 3000 TCP
    - Environment variables:
      - `NODE_ENV`: `production`
      - `PORT`: `3000`
      - `AWS_REGION`: `[your-region]`
      - `SQS_PROCESSING_QUEUE_URL`: `[your-queue-url]`
      - `SQS_REVIEW_QUEUE_URL`: `[your-review-queue-url]`
      - `S3_BUCKET`: `[your-bucket-name]`
      - `BEDROCK_MODEL_ID`: `[your-model-id]`
      - `DB_HOST`: `[your-aurora-endpoint]`
      - `DB_PORT`: `5432`
      - `DB_USERNAME`: `[your-db-username]`
      - `DB_PASSWORD`: `[your-db-password]`
      - `DB_NAME`: `document_processing`
    - Log configuration: Enable CloudWatch logs
12. Click "Add"
13. Click "Create"

## Step 10: Create Fargate Service

1. Go to your ECS cluster
2. Click "Services" tab
3. Click "Create"
4. Configure service:
   - Launch type: Fargate
   - Task definition: `document-processor-task`
   - Revision: Latest
   - Service name: `document-processor-service`
   - Number of tasks: 1 (scale as needed)
5. Click "Next step"
6. Configure network:
   - VPC: Select the same VPC as your RDS instance
   - Subnets: Select at least two subnets
   - Security groups: Create a new security group or use existing one
     - Allow inbound on port 3000
     - Allow outbound to RDS, internet, etc.
   - Auto-assign public IP: Enable (if needed)
7. Click "Next step"
8. Configure Auto Scaling (optional):
   - Minimum number of tasks: 1
   - Desired number of tasks: 1
   - Maximum number of tasks: 2
   - Scaling policies: Add CPU or memory utilization policies as needed
9. Click "Next step"
10. Review and click "Create Service"

## Step 11: Set Up CloudWatch Monitoring

1. Go to the [CloudWatch Console](https://console.aws.amazon.com/cloudwatch/)
2. Click "Dashboards" in the left navigation
3. Click "Create dashboard"
4. Enter dashboard name: `document-processing-dashboard`
5. Add widgets for:
   - SQS queue metrics (queue length, oldest message)
   - ECS service metrics (CPU, memory)
   - Custom metrics for document processing
6. Click "Create dashboard"

### Create Alarms
1. Click "Alarms" in the left navigation
2. Click "Create alarm"
3. Select metric (e.g., SQS queue length)
4. Configure threshold (e.g., greater than 100 for 15 minutes)
5. Configure actions (e.g., send notification to SNS topic)
6. Name and create the alarm
7. Repeat for other important metrics

## Step 12: Testing the Deployment

1. Upload a test document to your S3 bucket
2. Send a test message to your SQS queue:
   ```json
   {
     "bucket": "your-bucket-name",
     "key": "your-document-key",
     "jobId": "test-job-id"
   }
   ```
3. Monitor logs in CloudWatch to verify processing
4. Check DynamoDB tables for created nodes and relationships

## Troubleshooting

- **Container crashes**: Check CloudWatch logs for error messages
- **Database connection issues**: Verify security group rules allow traffic from Fargate tasks
- **Permission errors**: Review IAM roles and policies
- **Queue processing issues**: Check SQS visibility timeout and dead-letter queue

## Scaling Considerations

- Increase Fargate task count for higher throughput
- Configure auto-scaling based on SQS queue length
- Consider using reserved instances for cost optimization in production
- Set up alarms for queue backlog and processing failures 