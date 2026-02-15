export const typeDefs = /* GraphQL */ `
  type Category {
    id: ID!
    name: String!
  }

  type Vendor {
    id: ID!
    displayName: String!
    city: String!
    region: String!
  }

  type Service {
    id: ID!
    title: String!
    description: String!
    price: Float!           # dollars
    duration: String!       # "45 min" / "3 hrs"
    category: Category!
    vendor: Vendor!
    image: String
    rating: Float!          # avg rating
    reviews: Int!           # number of reviews
  }

  type Review {
    id: ID!
    bookingId: Int!
    customerId: Int!
    customerName: String!
    serviceId: Int!
    rating: Int!
    comment: String
    moderationStatus: String!
    createdAt: String!
  }

  type RatingDistribution {
    rating: Int!
    count: Int!
  }

  type RatingStats {
    serviceId: Int!
    averageRating: Float!
    totalReviews: Int!
    ratingDistribution: [RatingDistribution!]!
  }

  type ReviewAnalytics {
    totalReviews: Int!
    averageRating: Float!
    pendingReviews: Int!
    approvedReviews: Int!
    rejectedReviews: Int!
    recentReviews: [Review!]!
  }

  input ServiceFilter {
    search: String
    categoryId: ID
    minPrice: Float
    maxPrice: Float
    minRating: Float
  }

  enum ServiceSort {
    RELEVANCE
    PRICE_ASC
    PRICE_DESC
    RATING_DESC
  }

  type Query {
    categories: [Category!]!
    services(filter: ServiceFilter, sort: ServiceSort = RELEVANCE): [Service!]!
    service(id: ID!): Service
    
    # Review queries
    serviceReviews(serviceId: ID!): [Review!]!
    serviceRatingStats(serviceId: ID!): RatingStats!
    reviewAnalytics: ReviewAnalytics!
  }
`;
