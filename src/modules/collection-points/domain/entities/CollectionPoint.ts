export type CollectionPointStatus = "PENDING" | "APPROVED" | "REJECTED" | "INACTIVE";
export type CollectionPointLocationSource = "GPS_COORDINATES" | "VERIFIED_ADDRESS";
export type CollectionPointWeekday =
  "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
export interface CollectionPointOperatingHours {
  weekday: CollectionPointWeekday;
  openTime: string;
  closeTime: string;
}
export interface CollectionPointHour extends CollectionPointOperatingHours {
  id: string;
  isActive: boolean;
}
export interface CollectionPoint {
  id: string;
  collectorId: string;
  name: string;
  description: string | null;
  city: string;
  address: string;
  latitude: string;
  longitude: string;
  locationSource: CollectionPointLocationSource;
  placeId: string | null;
  whatsappContact: string | null;
  showWhatsappContact: boolean;
  hours: CollectionPointHour[];
  status: CollectionPointStatus;
  rejectionReason?: string | null;
  reviewedById?: string | null;
  reviewedAt?: Date | null;
  hoursConfirmedAt: Date;
  isOutdated: boolean;
  createdAt: Date;
  updatedAt: Date;
  wasteCategories: string[];
  collector?: { id: string; name: string; email: string };
}
export interface CollectionPointDraft {
  name: string;
  description?: string;
  city: string;
  address: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  whatsappContact?: string;
  showWhatsappContact: boolean;
  wasteCategories: string[];
}
export interface NewCollectionPointDraft extends CollectionPointDraft {
  operatingHours: CollectionPointOperatingHours[];
}
