import swaggerJsdoc from "swagger-jsdoc";

const weekdayEnum = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

const locationDescription =
  "Location (RN04): send valid GPS coordinates within Brazil (latitude + longitude), a verifiable address (placeId from GET /places/autocomplete), or both. With a placeId the server confirms the address with Google; when coordinates are also sent they must be within 1 km of it. A missing or invalid location returns 422.";

const collectionPointProperties = {
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
      example: "PLASTIC",
      description: "Código (name) de uma categoria ativa retornada por GET /waste-categories.",
    },
  },
  cooperative: {
    type: "object",
    required: [
      "cooperativeName",
      "cnpj",
      "street",
      "streetNumber",
      "neighborhood",
      "state",
      "postalCode",
      "email",
    ],
    properties: {
      cooperativeName: { type: "string", example: "Cooperativa Recicla Manhuaçu" },
      cnpj: {
        type: "string",
        pattern: "^[A-Z0-9]{12}[0-9]{2}$",
        description: "CNPJ válido, com ou sem pontuação.",
        example: "11222333000181",
      },
      street: { type: "string", example: "Avenida Getúlio Vargas" },
      streetNumber: { type: "string", example: "120" },
      neighborhood: { type: "string", example: "Centro" },
      state: {
        type: "string",
        enum: [
          "AC",
          "AL",
          "AP",
          "AM",
          "BA",
          "CE",
          "DF",
          "ES",
          "GO",
          "MA",
          "MT",
          "MS",
          "MG",
          "PA",
          "PB",
          "PR",
          "PE",
          "PI",
          "RJ",
          "RN",
          "RS",
          "RO",
          "RR",
          "SC",
          "SP",
          "SE",
          "TO",
        ],
        example: "MG",
      },
      postalCode: { type: "string", pattern: "^\\d{8}$", example: "36900000" },
      email: { type: "string", format: "email", example: "contato@cooperativa.org.br" },
    },
  },
};

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
        UserProfile: {
          type: "object",
          description:
            "User as returned by login, refresh, register, change-password and PATCH /users/me.",
          properties: {
            id: { type: "string", format: "uuid" },
            firebaseUid: { type: "string" },
            name: { type: "string", example: "Maria da Silva" },
            email: { type: "string", format: "email" },
            phone: { type: "string", example: "33999999999" },
            city: { type: "string", example: "Manhuaçu" },
            role: { type: "string", enum: ["CITIZEN", "COLLECTOR", "ADMIN"] },
            isBlocked: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            nickname: { type: "string", nullable: true, maxLength: 60, example: "Mari" },
            preferences: {
              type: "object",
              properties: {
                collectionAlerts: { type: "boolean", example: true },
                monthlyReports: { type: "boolean", example: true },
                cooperativeContact: { type: "boolean", example: false },
              },
            },
          },
        },
        CollectionPointInput: {
          type: "object",
          required: ["name", "city", "address", "wasteCategories", "operatingHours"],
          description: `${locationDescription} Operating hours are required on registration and are stored in the OperatingHours table. The cooperative configuration is optional for existing integrations.`,
          properties: {
            ...collectionPointProperties,
            operatingHours: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["weekday", "openTime", "closeTime"],
                properties: {
                  weekday: { type: "string", enum: weekdayEnum },
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
        CollectionPointUpdateInput: {
          type: "object",
          required: ["name", "city", "address", "wasteCategories"],
          description: `${locationDescription} When provided, operating hours and cooperative configuration are saved together and the point is resubmitted for approval. Existing integrations may continue updating hours through /collection-points/{id}/operating-hours.`,
          properties: {
            ...collectionPointProperties,
            operatingHours: {
              type: "array",
              minItems: 1,
              maxItems: 28,
              items: {
                type: "object",
                required: ["weekday", "openTime", "closeTime"],
                properties: {
                  weekday: { type: "string", enum: weekdayEnum },
                  openTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
                  closeTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
                },
              },
            },
          },
        },
        CollectionPointHour: {
          type: "object",
          description: "Operating hour read from the OperatingHours table.",
          properties: {
            id: { type: "string", format: "uuid" },
            weekday: { type: "string", enum: weekdayEnum },
            openTime: { type: "string", example: "08:00" },
            closeTime: { type: "string", example: "17:00" },
            isActive: { type: "boolean", example: true },
          },
        },
        EducationalContentInput: {
          type: "object",
          required: ["categoryId", "title", "summary", "content"],
          properties: {
            categoryId: { type: "string", description: "Id of an active waste category" },
            title: { type: "string", maxLength: 191, example: "Guia de descarte de baterias" },
            slug: {
              type: "string",
              maxLength: 191,
              pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
              description: "Optional. Generated from the title when omitted. Must be unique (409).",
              example: "guia-de-descarte-de-baterias",
            },
            summary: { type: "string", maxLength: 500, example: "Evite combustão espontânea." },
            content: { type: "string", description: "Body in Markdown", example: "### Por quê?" },
            format: {
              type: "string",
              enum: ["DISPOSAL_GUIDE", "DIY_TUTORIAL", "QUICK_FACT", "COMMUNITY_EVENT"],
              default: "DISPOSAL_GUIDE",
            },
            level: {
              type: "string",
              enum: ["ESSENTIAL", "INTERMEDIATE", "ADVANCED"],
              default: "ESSENTIAL",
            },
            readingTimeMinutes: { type: "integer", minimum: 1, maximum: 60, default: 3 },
            xpReward: { type: "integer", minimum: 0, maximum: 100, default: 0 },
            coverImageUrl: {
              type: "string",
              nullable: true,
              maxLength: 1000,
              pattern: "^https?://\\S+$",
              default: null,
            },
            status: {
              type: "string",
              enum: ["DRAFT", "PENDING_REVIEW", "PUBLISHED"],
              default: "DRAFT",
              description: "Only PUBLISHED content is visible on public routes.",
            },
            featured: {
              type: "boolean",
              default: false,
              description:
                "Pins the content on the citizen home. Requires status PUBLISHED (422) and unpins the previous one.",
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
