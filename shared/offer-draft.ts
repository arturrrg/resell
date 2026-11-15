export const OFFER_PROTOCOL = 1;
export const MAX_OFFER_PHOTOS = 10;
export const MAX_OFFER_BYTES = 25 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export type OfferPhoto = { id: string; name: string; type: string; blob: Blob };
export type OfferDraft = {
  accountPrices?: Record<string, string>;
  kind?: "offer" | "template";
  templateName?: string;
  sale?: { profit: number; soldAt: string; closed?: boolean; sourceDraftId?: string };
  publications?: { advertId: string; accountId: string; login: string; state: "published" | "submitted"; price?: string; currency?: "MDL" | "EUR" | "USD" }[];
  id: string;
  version: 1;
  title: string;
  secondaryTitle: string;
  description: string;
  price: string;
  currency: "MDL" | "EUR" | "USD";
  language: "ro" | "ru";
  brand: string;
  model: string;
  storage: string;
  ram: string;
  condition: "used" | "new";
  sellerType: "private" | "shop";
  deviceType: string;
  operatingSystem: string;
  batteryHealth: string;
  batteryCapacity: string;
  color: string;
  phone: string;
  location: string;
  photos: OfferPhoto[];
  createdAt: string;
  updatedAt: string;
};
export type TransferPhoto = {
  name: string;
  type: string;
  base64: string;
  bytes: number;
};
export type OfferTransfer = Omit<OfferDraft, "photos"> & {
  protocol: 1;
  photos: TransferPhoto[];
};
export type TransferReport = {
  status: "ready" | "partial" | "blocked";
  filled: string[];
  missing: string[];
  photos: number;
  message: string;
};
export function newOffer(): OfferDraft {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    version: 1,
    title: "",
    secondaryTitle: "",
    description: "",
    price: "",
    currency: "MDL",
    language: "ro",
    brand: "",
    model: "",
    storage: "",
    ram: "",
    condition: "used",
    sellerType: "private",
    deviceType: "Smartphone-uri",
    operatingSystem: "",
    batteryHealth: "100",
    batteryCapacity: "",
    color: "",
    phone: "",
    location: "",
    photos: [],
    createdAt: now,
    updatedAt: now,
  };
}
export function offerProblems(draft: OfferDraft): string[] {
  const problems: string[] = [];
  if (!draft.title.trim()) problems.push("Add a title.");
  if (draft.title.length > 100)
    problems.push("999.md allows a title of up to 100 characters.");
  if ((draft.secondaryTitle || "").length > 100)
    problems.push("The second title must be no longer than 100 characters.");
  if (!draft.description.trim()) problems.push("Add a description.");
  if (draft.description.length > 2000)
    problems.push("999.md allows a description of up to 2,000 characters.");
  if (
    !/^\d+(?:[.,]\d{1,2})?$/.test(draft.price) ||
    Number(draft.price.replace(",", ".")) <= 0
  )
    problems.push("Enter a valid asking price.");
  if (!["MDL", "EUR", "USD"].includes(draft.currency))
    problems.push("Choose a supported currency.");
  if (!["ro", "ru"].includes(draft.language))
    problems.push("Choose Romanian or Russian.");
  if (!draft.brand.trim() || !draft.model.trim())
    problems.push("Add the brand and model.");
  if (!draft.operatingSystem.trim()) problems.push("Add the operating system.");
  if (!draft.deviceType.trim()) problems.push("Add the device type.");
  if (!draft.location.trim()) problems.push("Add the location.");
  if (
    draft.batteryHealth &&
    (!/^\d{1,3}$/.test(draft.batteryHealth) ||
      Number(draft.batteryHealth) > 100)
  )
    problems.push("Battery health must be between 0 and 100%.");
  if (
    draft.batteryCapacity &&
    (!/^\d{1,6}$/.test(draft.batteryCapacity) ||
      Number(draft.batteryCapacity) <= 0)
  )
    problems.push("Enter battery capacity in mAh.");
  if (!draft.photos.length) problems.push("Add at least one photo.");
  if (draft.photos.length > MAX_OFFER_PHOTOS)
    problems.push(`Use at most ${MAX_OFFER_PHOTOS} photos.`);
  if (
    draft.photos.some(
      (photo) =>
        !PHOTO_TYPES.includes(photo.type) ||
        photo.blob.type !== photo.type ||
        !photo.blob.size,
    )
  )
    problems.push("Use valid JPEG, PNG or WebP photos.");
  if (
    draft.photos.reduce((sum, photo) => sum + photo.blob.size, 0) >
    MAX_OFFER_BYTES
  )
    problems.push("Photos must total less than 25 MB.");
  if (
    [
      draft.brand,
      draft.model,
      draft.storage,
      draft.ram,
      draft.deviceType,
      draft.operatingSystem,
      draft.color,
      draft.location,
    ].some((value) => value.length > 150) ||
    draft.phone.length > 40
  )
    problems.push("A specification is too long.");
  return problems;
}
export async function transferOffer(draft: OfferDraft): Promise<OfferTransfer> {
  const problems = offerProblems(draft);
  if (problems.length) throw Error(problems.join(" "));
  const photos = await Promise.all(
    draft.photos.map(async (photo) => {
      const bytes = new Uint8Array(await photo.blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return {
        name: photo.name.replace(/[^\p{L}\p{N}_. -]/gu, "_").slice(0, 100),
        type: photo.type,
        bytes: bytes.length,
        base64: btoa(binary),
      };
    }),
  );
  const { kind, templateName, sale, publications, accountPrices, ...advert } = draft;
  return { ...advert, protocol: OFFER_PROTOCOL, photos };
}
export function readOfferTransfer(value: unknown): OfferTransfer {
  if (!value || typeof value !== "object")
    throw Error("Invalid offer transfer.");
  const input = value as Record<string, unknown>;
  if (
    input.protocol !== OFFER_PROTOCOL ||
    input.version !== 1 ||
    !Array.isArray(input.photos) ||
    input.photos.length > MAX_OFFER_PHOTOS
  )
    throw Error("Unsupported offer transfer.");
  const draft = newOffer();
  for (const key of Object.keys(draft).filter(
    (key) => key !== "photos" && key !== "version",
  )) {
    if (key === "secondaryTitle" && input[key] === undefined) continue;
    if (typeof input[key] !== "string" || (input[key] as string).length > 30000)
      throw Error(`Invalid ${key}.`);
    (draft as unknown as Record<string, unknown>)[key] = input[key];
  }
  const photos: TransferPhoto[] = [];
  let total = 0;
  for (const raw of input.photos) {
    if (!raw || typeof raw !== "object") throw Error("Invalid photo.");
    const photo = raw as TransferPhoto;
    if (
      !PHOTO_TYPES.includes(photo.type) ||
      typeof photo.name !== "string" ||
      photo.name.length > 100 ||
      /[\\/\x00-\x1f]/.test(photo.name) ||
      typeof photo.base64 !== "string" ||
      !Number.isInteger(photo.bytes) ||
      photo.bytes <= 0 ||
      photo.bytes > MAX_OFFER_BYTES
    )
      throw Error("Invalid photo metadata.");
    total += photo.bytes;
    if (
      total > MAX_OFFER_BYTES ||
      photo.base64.length !== 4 * Math.ceil(photo.bytes / 3) ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(photo.base64)
    )
      throw Error("Photo payload exceeds its limits or is incomplete.");
    const binary = atob(photo.base64);
    if (binary.length !== photo.bytes)
      throw Error("Photo payload is incomplete.");
    const jpeg =
      binary.charCodeAt(0) === 255 &&
      binary.charCodeAt(1) === 216 &&
      binary.charCodeAt(2) === 255;
    const png = binary.slice(0, 8) === "\x89PNG\r\n\x1a\n";
    const webp =
      binary.slice(0, 4) === "RIFF" && binary.slice(8, 12) === "WEBP";
    if (!(
      (photo.type === "image/jpeg" && jpeg) ||
      (photo.type === "image/png" && png) ||
      (photo.type === "image/webp" && webp)
    ))
      throw Error("Photo data does not match its format.");
    draft.photos.push({
      id: crypto.randomUUID(),
      name: photo.name,
      type: photo.type,
      blob: new Blob([Uint8Array.from(binary, (c) => c.charCodeAt(0))], {
        type: photo.type,
      }),
    });
    photos.push({
      name: photo.name,
      type: photo.type,
      base64: photo.base64,
      bytes: photo.bytes,
    });
  }
  if (
    !["new", "used"].includes(draft.condition) ||
    !["private", "shop"].includes(draft.sellerType)
  )
    throw Error("Invalid offer specifications.");
  const problems = offerProblems(draft);
  if (problems.length) throw Error(problems.join(" "));
  return { ...draft, protocol: 1, photos };
}
