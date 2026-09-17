import swaggerJsdoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Ecoponto API",
      version: "1.0.0",
      description: "API for managing collection points, disposals and reports",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Firebase ID Token",
        },
      },
    },
  },
  apis: ["./src/modules/**/presentation/*.routes.ts"],
});
