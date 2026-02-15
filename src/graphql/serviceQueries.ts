import { gql } from "@apollo/client";

export const GET_CATEGORIES = gql`
  query GetCategories {
    categories {
      id
      name
    }
  }
`;

export const GET_SERVICES = gql`
  query GetServices($filter: ServiceFilter, $sort: ServiceSort) {
    services(filter: $filter, sort: $sort) {
      id
      title
      price
      duration
      image
      rating
      reviews
      category {
        id
        name
      }
      vendor {
        id
        displayName
        city
        region
      }
    }
  }
`;

export const GET_SERVICE_BY_ID = gql`
  query GetServiceById($id: ID!) {
    service(id: $id) {
      id
      title
      description
      price
      duration
      image
      rating
      reviews
      category {
        id
        name
      }
      vendor {
        id
        displayName
        city
        region
      }
    }
  }
`;

export const GET_SERVICE_REVIEWS = gql`
  query GetServiceReviews($serviceId: ID!) {
    serviceReviews(serviceId: $serviceId) {
      id
      bookingId
      customerId
      customerName
      rating
      comment
      moderationStatus
      createdAt
    }
  }
`;

export const GET_SERVICE_RATING_STATS = gql`
  query GetServiceRatingStats($serviceId: ID!) {
    serviceRatingStats(serviceId: $serviceId) {
      serviceId
      averageRating
      totalReviews
      ratingDistribution {
        rating
        count
      }
    }
  }
`;

export const GET_REVIEW_ANALYTICS = gql`
  query GetReviewAnalytics {
    reviewAnalytics {
      totalReviews
      averageRating
      pendingReviews
      approvedReviews
      rejectedReviews
      recentReviews {
        id
        bookingId
        customerId
        customerName
        serviceId
        rating
        comment
        moderationStatus
        createdAt
      }
    }
  }
`;
