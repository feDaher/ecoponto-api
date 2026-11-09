import type { PublicCollectionPoint } from "../domain/repositories/ICollectionPointSearchRepository";

export function toPublicCollectionPoint<T extends PublicCollectionPoint>(point: T) {
  return {
    ...point,
    whatsappContact: point.showWhatsappContact ? point.whatsappContact : null,
  };
}
