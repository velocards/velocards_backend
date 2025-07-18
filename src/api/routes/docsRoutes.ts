import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

const router = Router();

// Serve Swagger UI
// Dynamically import swagger spec to avoid build errors if not generated yet
router.use('/', async (req, res, next) => {
  try {
    const swaggerDocument = await import('../../swagger/swagger.json');
    swaggerUi.setup(swaggerDocument.default, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'VeloCards API Documentation',
      customfavIcon: 'https://velocards.com/favicon.ico'
    })(req, res, next);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DOCS_NOT_GENERATED',
        message: 'API documentation not generated. Run: npm run swagger'
      }
    });
  }
});

router.use('/', swaggerUi.serve);

export default router;