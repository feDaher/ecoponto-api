import {
  collectionPointSchema,
  collectionPointUpdateSchema,
} from "../../src/modules/collection-points/presentation/collection-points.validators";

const validPoint = {
  name: "Eco Ponto Centro",
  city: "Manhuaçu",
  address: "Avenida Getúlio Vargas, 120",
  latitude: -20.258,
  longitude: -42.0336,
  showWhatsappContact: false,
  wasteCategories: ["PLASTIC", "GLASS"],
  operatingHours: [{ weekday: "MONDAY", openTime: "08:00", closeTime: "17:00" }],
  cooperative: {
    cooperativeName: "Cooperativa Recicla Manhuaçu",
    cnpj: "11.222.333/0001-81",
    street: "Avenida Getúlio Vargas",
    streetNumber: "120",
    neighborhood: "Centro",
    state: "mg",
    postalCode: "36900-000",
    email: " contato@cooperativa.org.br ",
  },
};

describe("collection point cooperative configuration validation", () => {
  it("normalizes and accepts valid cooperative and address details", () => {
    const result = collectionPointSchema.safeParse(validPoint);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cooperative).toMatchObject({
      cnpj: "11222333000181",
      state: "MG",
      postalCode: "36900000",
      email: "contato@cooperativa.org.br",
    });
  });

  it("validates the check digits of numeric and alphanumeric CNPJs", () => {
    const numeric = collectionPointSchema.safeParse(validPoint);
    const alphanumeric = collectionPointSchema.safeParse({
      ...validPoint,
      cooperative: { ...validPoint.cooperative, cnpj: "12ABC34501DE35" },
    });
    const invalid = collectionPointSchema.safeParse({
      ...validPoint,
      cooperative: { ...validPoint.cooperative, cnpj: "11.222.333/0001-82" },
    });

    expect(numeric.success).toBe(true);
    expect(alphanumeric.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("rejects invalid addresses, e-mail, phone numbers, and operating intervals", () => {
    const invalidAddress = collectionPointSchema.safeParse({
      ...validPoint,
      cooperative: { ...validPoint.cooperative, postalCode: "123" },
    });
    const invalidEmail = collectionPointSchema.safeParse({
      ...validPoint,
      cooperative: { ...validPoint.cooperative, email: "not-an-email" },
    });
    const invalidHours = collectionPointSchema.safeParse({
      ...validPoint,
      operatingHours: [{ weekday: "MONDAY", openTime: "17:00", closeTime: "08:00" }],
    });
    const overlappingHours = collectionPointSchema.safeParse({
      ...validPoint,
      operatingHours: [
        { weekday: "MONDAY", openTime: "08:00", closeTime: "12:00" },
        { weekday: "MONDAY", openTime: "11:00", closeTime: "14:00" },
      ],
    });
    const invalidPhone = collectionPointSchema.safeParse({
      ...validPoint,
      whatsappContact: "telefoneee",
      showWhatsappContact: true,
    });
    const invalidState = collectionPointSchema.safeParse({
      ...validPoint,
      cooperative: { ...validPoint.cooperative, state: "XX" },
    });

    expect(invalidAddress.success).toBe(false);
    expect(invalidEmail.success).toBe(false);
    expect(invalidHours.success).toBe(false);
    expect(overlappingHours.success).toBe(false);
    expect(invalidPhone.success).toBe(false);
    expect(invalidState.success).toBe(false);
  });

  it("allows an owner to update hours and complete cooperative configuration together", () => {
    const { operatingHours, ...point } = validPoint;
    const result = collectionPointUpdateSchema.safeParse({ ...point, operatingHours });

    expect(result.success).toBe(true);
  });
});
