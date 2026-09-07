export type Testimonial = {
  id: string;
  clientName: string;
  roleTitle: string;
  quote: string;
  projectId: string | null;
  published: boolean;
  displayOrder: number;
  createdAt: string;
};

export type TestimonialDraft = {
  clientName: string;
  roleTitle: string;
  quote: string;
  projectId: string | null;
  published: boolean;
  displayOrder: number;
};

export const emptyTestimonialDraft: TestimonialDraft = {
  clientName: "",
  roleTitle: "",
  quote: "",
  projectId: null,
  published: false,
  displayOrder: 0,
};
