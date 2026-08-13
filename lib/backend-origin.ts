import 'server-only';

// German Steels uses the same backend in local development and every deployment.
// Keep this server-only so browsers continue calling the same-origin /api/proxy route.
export const GERMAN_STEELS_BACKEND_ORIGIN =
  'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
