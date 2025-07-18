import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// Function to load swagger document
function loadSwaggerDocument() {
  // Try different possible paths
  const possiblePaths = [
    path.join(__dirname, '../../swagger/swagger.json'),
    path.join(__dirname, '../../../src/swagger/swagger.json'),
    path.join(process.cwd(), 'src/swagger/swagger.json'),
    path.join(process.cwd(), 'dist/src/swagger/swagger.json'),
  ];

  for (const swaggerPath of possiblePaths) {
    try {
      if (fs.existsSync(swaggerPath)) {
        const content = fs.readFileSync(swaggerPath, 'utf8');
        console.log(`Loaded swagger from: ${swaggerPath}`);
        return JSON.parse(content);
      }
    } catch (error) {
      console.log(`Failed to load from ${swaggerPath}:`, error);
    }
  }

  // Return a minimal valid OpenAPI document if not found
  console.error('Swagger document not found in any location');
  return {
    openapi: '3.0.0',
    info: {
      title: 'VeloCards API',
      version: '1.0.0',
      description: 'Virtual card management and crypto payment platform API',
      contact: {
        name: 'VeloCards Support',
        email: 'support@velocards.com',
        url: 'https://velocards.com'
      }
    },
    servers: [
      {
        url: 'https://api.velocards.com/api/v1',
        description: 'Production server'
      },
      {
        url: 'http://localhost:3001/api/v1',
        description: 'Development server'
      }
    ],
    paths: {
      '/health': {
        get: {
          summary: 'Health check',
          description: 'Check if the API is running',
          responses: {
            '200': {
              description: 'API is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      environment: { type: 'string' },
                      database: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        Bearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  };
}

// Load the swagger document
const swaggerDocument = loadSwaggerDocument();

// Setup Swagger UI options
const options = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'VeloCards API Documentation',
  customfavIcon: 'https://velocards.com/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
  }
};

// Serve Swagger UI static files first
router.use('/', swaggerUi.serve);

// Setup Swagger UI with the document
router.get('/', swaggerUi.setup(swaggerDocument, options));

// Also serve the raw swagger.json
router.get('/swagger.json', (_req, res) => {
  res.json(swaggerDocument);
});

export default router;