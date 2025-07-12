/**
 * Main types export file for MedGenEMR TypeScript migration
 * 
 * This file re-exports all type definitions used throughout the application,
 * providing a single entry point for importing types.
 */

// FHIR types and utilities
export * from './fhir';

// Clinical workflow and application types
export * from './clinical';

// API request/response types
export * from './api';

// React and component types
export * from './components';

// Legacy type compatibility (to be removed after migration)
export * from './legacy';