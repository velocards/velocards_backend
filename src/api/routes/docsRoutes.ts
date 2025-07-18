import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// Function to load swagger document
function loadSwaggerDocument() {
  try {
    // In production, the swagger.json needs to be explicitly included
    const swaggerPath = path.join(__dirname, '../../swagger/swagger.json');
    
    if (fs.existsSync(swaggerPath)) {
      const swaggerContent = fs.readFileSync(swaggerPath, 'utf8');
      return JSON.parse(swaggerContent);
    }
    
    // If not found, try the source directory (for development)
    const devPath = path.join(process.cwd(), 'src/swagger/swagger.json');
    if (fs.existsSync(devPath)) {
      const swaggerContent = fs.readFileSync(devPath, 'utf8');
      return JSON.parse(swaggerContent);
    }
    
    throw new Error('swagger.json not found');
  } catch (error) {
    console.error('Failed to load swagger.json:', error);
    // Return a minimal valid OpenAPI document if not found
    return {
      openapi: '3.0.0',
      info: {
        title: 'VeloCards API',
        version: '1.0.0',
        description: 'API documentation not generated. Please run: npm run swagger',
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
      paths: {},
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