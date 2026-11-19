interface WhatsappVisibility {
  showWhatsappContact?: boolean;
  whatsappContact?: string | null;
}

interface RouteCoordinates {
  latitude: unknown;
  longitude: unknown;
}

export function toPublicCollectionPoint<T extends WhatsappVisibility & RouteCoordinates>(point: T) {
  const latitude = point.latitude === null ? null : Number(point.latitude);
  const longitude = point.longitude === null ? null : Number(point.longitude);
  const googleMapsUrl =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    (latitude !== 0 || longitude !== 0)
      ? `https://www.google.com/maps/dir/?${new URLSearchParams({
          api: "1",
          destination: `${latitude},${longitude}`,
          travelmode: "driving",
        }).toString()}`
      : null;

  return {
    ...point,
    whatsappContact: point.showWhatsappContact ? point.whatsappContact : null,
    googleMapsUrl,
  };
}
