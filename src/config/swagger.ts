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
      schemas: {
        CollectionPointInput: {
          type: "object",
          required: ["name", "city", "address", "wasteCategories", "operatingHours"],
          description:
            "Location (RN04): send valid GPS coordinates within Brazil (latitude + longitude), a verifiable address (placeId from GET /places/autocomplete), or both. With a placeId the server confirms the address with Google; when coordinates are also sent they must be within 1 km of it. A missing or invalid location returns 422.",
          properties: {
            name: { type: "string", example: "Eco Ponto Centro" },
            description: { type: "string", example: "Recebimento de recicláveis" },
            city: { type: "string", example: "Manhuaçu" },
            address: { type: "string", example: "Rua A, 10" },
            latitude: { type: "number", format: "double", example: -20.25 },
            longitude: { type: "number", format: "double", example: -42.03 },
            placeId: {
              type: "string",
              pattern: "^[A-Za-z0-9_-]{1,512}$",
              description: "Google place id of a verifiable address",
            },
            whatsappContact: { type: "string", example: "33999999999" },
            showWhatsappContact: { type: "boolean", default: false },
            wasteCategories: {
              type: "array",
              minItems: 1,
              items: {
                type: "string",
                enum: [
                  "PLASTIC",
                  "PAPER",
                  "METALS",
                  "GLASS",
                  "COOKING_OIL",
                  "ELECTRONICS",
                  "BATTERIES",
                  "CELL_PHONES",
                  "COMPUTERS",
                  "PRINTERS",
                  "TELEVISIONS",
                ],
              },
            },
            operatingHours: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["weekday", "openTime", "closeTime"],
                properties: {
                  weekday: {
                    type: "string",
                    enum: [
                      "MONDAY",
                      "TUESDAY",
                      "WEDNESDAY",
                      "THURSDAY",
                      "FRIDAY",
                      "SATURDAY",
                      "SUNDAY",
                    ],
                  },
                  openTime: {
                    type: "string",
                    pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
                    example: "08:00",
                  },
                  closeTime: {
                    type: "string",
                    pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
                    example: "17:00",
                  },
                },
              },
            },
          },
        },
        CollectionPointReview: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["APPROVED", "REJECTED"] },
            rejectionReason: {
              type: "string",
              description: "Required when status is REJECTED.",
              example: "O endereço precisa ser confirmado",
            },
          },
        },
      },
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
