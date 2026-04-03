// Minimal resolver typing to keep the server strongly typed without codegen.
// This intentionally only includes the parts we use.

export type ServiceSort = "RELEVANCE" | "PRICE_ASC" | "PRICE_DESC" | "RATING_DESC";

export type ServiceFilter = {
  search?: string | null;
  categoryId?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minRating?: number | null;
};

export type QueryServicesArgs = {
  filter?: ServiceFilter | null;
  sort?: ServiceSort | null;
};

export type QueryServiceArgs = {
  id: string;
};

export type Resolvers = {
  Query: {
    categories: () => unknown;
    services: (parent: unknown, args: QueryServicesArgs) => unknown;
    service: (parent: unknown, args: QueryServiceArgs) => unknown;
  };
  Service: {
    price: (parent: any) => number;
    duration: (parent: any) => string;
    image: (parent: any) => string | null;
    category: (parent: any) => unknown;
    vendor: (parent: any) => unknown;
    rating: (parent: any) => number;
    reviews: (parent: any) => number;
  };
};
