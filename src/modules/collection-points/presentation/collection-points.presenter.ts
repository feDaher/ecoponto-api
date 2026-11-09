interface WhatsappVisibility {
  showWhatsappContact: boolean;
  whatsappContact: string | null;
}

export function toPublicCollectionPoint<T extends WhatsappVisibility>(point: T) {
  return {
    ...point,
    whatsappContact: point.showWhatsappContact ? point.whatsappContact : null,
  };
}
