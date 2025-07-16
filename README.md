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



1. Consume Message (SQS)
System continuously polls SQS for messages
Each message contains s3Bucket and s3Key for the document classification, extraction

2. Fetch Schema and Document Classification
- Use the S3 client to download the JSON  (document extraction(entites, field, mapping)).
- Fetch Schema by API to fetch schema of this system 

3. Save Initial Status in Document DB
Log status to DynamoDB (INITIAL) with document ID and timestamp.

4. Build LLM Prompt
Construct a prompt using two input from step 2: schema sql && document classification-extraction
Include fields like name, type, value, etc.
Apply any business-specific phrasing or formatting.
Mapping for each attribute with logical entites and physical entites

5. Invoke Bedrock LLM
Log status to DynamoDB (PROCESSING) with document ID and timestamp.

Send the prompt to the Bedrock LLM (Claude, Titan, etc.).

Get the response (JSON mapping or structured text).

6. Manual Review Decision
If LLM response contains invalid data (e.g., underscores _ in keys):
Flag for manual review and push to a separate SQS queue or status.
Else:
Mark as completed.

7. Save Final Status and Mappings
Store status and LLM full response in DocumentTable.

Extract terms and their mapped attributes from LLM response:

Save each term → attribute pair into DocumentTermMappingTable.

Include document_id for traceability.


DocumentMappingTable
Track document status

DocumentTermMappingTable
Field	Description
term	The raw term extracted from the document
mapped_attribute	Attribute (physical table/column) LLM mapped to
logical_entity	Logical entity name (business context)
confidence_score	(Optional) LLM confidence or manual adjustment flag
document_id	Reference to source document
schema_version	Reference to schema snapshot/version
source_type	e.g., LLM, MANUAL_REVIEW, CORRECTED
status 
created_at	Timestamp

