/**
 * Admin API for Data Settings
 * 
 * Re-exports from ingestion-settings for backward compatibility.
 * The original route was named "data-settings" but the file was at "ingestion-settings".
 */

export { GET, PATCH } from '../ingestion-settings/route';
