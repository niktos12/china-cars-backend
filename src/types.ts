export type ProductDto = {
  id: number;
  slug: string;
  title: string;
  carModel: string;
  position: string;
  material: string;
  description: string;
  priceFrom: number | null;
  imageUrl: string | null;
};

export type LeadActionResult =
  | { ok: true; id: number | null; demo: boolean }
  | { ok: false; error: string };

export type ProductMutationResult =
  | { ok: true; id: number; demo: boolean; slug: string }
  | { ok: false; error: string; demo?: boolean };

export type SimpleResult =
  | { ok: boolean; demo?: boolean; error?: string };
