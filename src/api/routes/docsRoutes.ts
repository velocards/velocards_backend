import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

const router = Router();

let swaggerDocument: any;
try {
  swaggerDocument = require('../../swagger/swagger.json');
} catch (error) {
  console.error('Swagger document not found. Run npm run swagger to generate it.');
  swaggerDocument = {
    openapi: '3.0.0',
    info: {
      title: 'VeloCards API',
      version: '1.0.0',
      description: 'API documentation not generated. Please run: npm run swagger'
    },
    paths: {}
  };
}

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