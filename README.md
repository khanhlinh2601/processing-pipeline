<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).



src/
├── client/              # External integrations (SQS, S3, Bedrock, etc.)
│   ├── s3.client.ts
│   ├── sqs.client.ts
│   ├── bedrock.client.ts
│   └── dynamo.client.ts
│
├── db/                  # DB layer (DynamoDB repositories)
│   ├── document.repository.ts
│
├── fetch-schema/        # fetch & parse schema from another service
│   |── fetch-schema.service.ts
│   ├── fetch-schema.controller.ts
│   └── fetch-schema.module.ts
│
├── processor/           # Domain use-case: process document with LLM
│   └── processor.service.ts
│   └── processor.controller.ts
│   └── processor.module.ts
│
├── shared/              # Shared utilities (logger, config, constants, dto)
│   ├── logger.ts
│   ├── config.ts
│   └── constants.ts
|__ app.module.ts
└── main.ts              # App entry point (consumer listener loop)



# Document Lineage Enrichment Process

This document describes the detailed steps for enriching document extraction data with lineage mapping using AWS services, Bedrock LLM, and Aurora PostgreSQL.

---

## Step 1: Consume Message (SQS) and Pre-handle Document Extraction

* **Source**: AWS SQS Queue
* **Action**:

  * Continuously poll SQS for incoming messages.
  * Each message contains the following payload:

    ```json
    {
      "bucket": "bucket-name",
      "key": "document-key",
      "jobId": "uuid"
    }
    ```
  * Download the JSON file from S3 with the provided bucket/key.
  * Expected JSON structure:

    ```json
    {
      "extracted_data_entities": { ... }
    }
    ```

---

## Step 2: Update Document Job Status

* **Database**: Aurora PostgreSQL - `documentjob` table
* **Action**:

  * Update the document job status to `ENRICHMENTING` for traceability.
  * Insert or update log status for monitoring.

---

## Step 3: Build LLM Prompt

* **Inputs**:

  * Document Classification Data
  * Extracted Entities
* **Action**:

  * Format a structured prompt including:

    * Document context (name, type, metadata)
    * Entity details (name, type, value)
    * Business-specific formatting
    * Include requirement for lineage mapping with logical and physical entities.
* **Example Prompt**:

  ```text
  You are an expert in data lineage classification.
  Classify and map the following entities extracted from the document.
  {JSON data here}
  Output the lineage nodes and their relationships.
  ```

---

## Step 4: Invoke Bedrock LLM

* **Service**: AWS Bedrock (Claude, Titan)
* **Action**:

  * Log `PROCESSING` status in DynamoDB with `documentId` and timestamp.
  * Send prompt to Bedrock.
  * Capture the response which should include structured lineage mapping.

---

## Step 5: Manual Review Decision

* **Condition**:

  * Validate the LLM response:

    * If keys contain invalid values (e.g., underscores), mark for **manual review**.
    * Push to manual review SQS queue or set a status flag.
  * Otherwise, proceed to mark as **COMPLETED**.

---

## Step 6: Save Final Status and Mappings

* **Database**:

  * `DocumentJob` → exist table
  * `lineage_node`, `lineage_relationship` → dynamodb

* **Nodes Format**:

  ```json
  {
    "id": "tbl_account",
    "type": "table",
    "data": {
      "label": "account",
      "columns": [
        { "name": "id", "type": "bigint", "classification": "IDENTIFIER" },
        { "name": "full_name", "type": "string", "classification": "DESCRIPTIVE" }
      ],
      "metadata": { "businessOwner": "xWyvernPx", "description": "Main production database for customer data" }
    },
    "position": { "x": 0, "y": 0 }
  }
  ```

* **Edges Format**:

  ```json
  {
    "id": "tbl_payment-user_id-tbl_account-id",
    "source": "tbl_payment",
    "target": "tbl_account",
    "type": "smoothstep",
    "label": "user_id → id"
  }
  ```

* **Final Action**:

  * Insert/update lineage nodes (`Lineage_node`) and relationships (`Lineage_rrela`) in Aurora PostgreSQL.
  * Ensure traceability with `jobId`, `documentId` references.

---

## Summary Architecture

| Step | Description                      | AWS Service / DB             |
| ---- | -------------------------------- | ---------------------------- |
| 1    | Poll SQS and fetch S3 extraction | SQS, S3                      |
| 2    | Update processing status         | Aurora Postgres              |
| 3    | Build prompt                     | Application Service          |
| 4    | Invoke LLM                       | Bedrock, DynamoDB            |
| 5    | Manual check if needed           | SQS (Review Queue)           |
| 6    | Save lineage mappings            | Aurora Postgres, Document DB |

---

✅ **Goal**: A fully automated pipeline for extracting and enriching document metadata into a structured data lineage system using LLM assistance with traceability and fallback manual review.


CREATE TABLE lineage_node (
    node_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_type VARCHAR(50) NOT NULL,               -- 'table', 'column', 'business_term', etc.
    node_name VARCHAR(255) NOT NULL,              -- e.g., 'account', 'payment' 
    qualified_name VARCHAR(500) NOT NULL,         -- e.g., 'neondb.public.account' 
    metadata JSONB,                               -- flexible for business metadata
    job_id UUID NOT NULL,
    system TEXT,                                  -- e.g., 'corebank', 'crm', 'payment_gateway'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lineage_relationship (
    relationship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node_id UUID NOT NULL REFERENCES lineage_node(node_id),
    target_node_id UUID NOT NULL REFERENCES lineage_node(node_id),
    relationship_type VARCHAR(100) NOT NULL,     -- e.g., 'foreign_key', 'business_reference'
    business_rule JSONB,
    source_meta JSONB,                           -- column information of source
    target_meta JSONB,                           -- column information of target
    confidence DECIMAL(3,2),                     -- optional AI confidence
    is_verified BOOLEAN DEFAULT false,
    job_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

export interface DocumentJob {
  jobId: string;                       // UUID for tracking processing job
  documentId: string;                  // Unique identifier for the document
  bucket: string;                      // S3 bucket storing the document
  key: string;                         // S3 key (path) of the document
  status: DocumentProcessingStatus;    // Enum status (e.g., PENDING, PROCESSING, COMPLETED, FAILED)

  createdAt: string;                   // ISO timestamp when the job was created
  updatedAt: string;                   // ISO timestamp for last update (for UI tracking)
  timestamp: string;                   // DynamoDB sort key (e.g., createdAt or updatedAt)

  originalName?: string;               // Optional: original file name (useful for UI)
  completedAt?: string;                // Optional: ISO timestamp when completed
  errorMessage?: string;               // Optional: detailed error message if failed
  textractFeatures?: string[];         // Optional: Textract features used (e.g., ["TABLES", "FORMS"])
  textractJobId?: string;              // Optional: AWS Textract Job ID for traceability
}

