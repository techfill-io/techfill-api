import type { INestApplication } from '@nestjs/common'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'

import { AppModule } from './app.module'

function setupPipes(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
}

function setupCors(app: INestApplication, configService: ConfigService) {
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000')
  app.enableCors({
    origin: corsOrigin.split(',').map(o => o.trim()),
    credentials: true,
  })
}

function setupVersioning(app: INestApplication, configService: ConfigService) {
  const apiVersioningType = (
    configService.get<string>('API_VERSIONING_TYPE', 'uri') || 'uri'
  ).toLowerCase()
  const apiDefaultVersion = configService.get<string>('API_DEFAULT_VERSION', '1')

  if (apiVersioningType === 'header') {
    app.enableVersioning({
      type: VersioningType.HEADER,
      header: 'x-api-version',
      defaultVersion: apiDefaultVersion,
    })
  } else {
    app.enableVersioning({
      type: VersioningType.URI,
      prefix: 'v',
      defaultVersion: apiDefaultVersion,
    })
  }
  return apiDefaultVersion
}

function setupSwagger(
  app: INestApplication,
  configService: ConfigService,
  apiDefaultVersion: string,
) {
  const swaggerEnabled = configService.get<string>('ENABLE_SWAGGER', 'true')
  if (swaggerEnabled !== 'true') return

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Techfill API')
    .setDescription('Techfill API documentation')
    .setVersion(apiDefaultVersion.toString())
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  })
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  app.setGlobalPrefix('api')

  setupPipes(app)
  setupCors(app, configService)
  const apiDefaultVersion = setupVersioning(app, configService)
  setupSwagger(app, configService, apiDefaultVersion)

  const port = configService.get<number>('PORT', 3001)
  await app.listen(port)
}

void bootstrap()
