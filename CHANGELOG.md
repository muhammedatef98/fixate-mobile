# Changelog

All notable changes to the Fixate mobile app will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-22

### Added
- ✅ Complete Supabase integration for backend services
- ✅ Separate authentication flows for customers and technicians
- ✅ Service request system with location-based matching
- ✅ Real-time order tracking
- ✅ Media upload functionality for order images
- ✅ Bilingual support (Arabic/English)
- ✅ Dark mode support
- ✅ Interactive maps for location selection
- ✅ Technician dashboard with available orders
- ✅ Customer dashboard with order history
- ✅ Rating and review system
- ✅ Email verification with SendGrid SMTP

### Changed
- 🔄 Migrated from VPS API to Supabase
- 🔄 Updated all API calls to use Supabase client
- 🔄 Removed expo-dev-client for Expo Go compatibility
- 🔄 Fixed useAppContext to useApp naming consistency

### Fixed
- 🐛 Fixed order submission error by adding missing database columns
- 🐛 Fixed authentication context import issues
- 🐛 Fixed services API integration
- 🐛 Resolved Expo Go compatibility issues

### Removed
- ❌ Removed old VPS API files (api.ts, unified-api.ts, mobile-api-adapter.ts)
- ❌ Removed expo-dev-client dependency

### Database Schema Updates
- Added `service_type` column to orders table
- Added `location` column to orders table
- Added `latitude` column to orders table
- Added `longitude` column to orders table
- Added `media_urls` column to orders table

### Security
- 🔒 All sensitive keys moved to environment variables
- 🔒 Row Level Security (RLS) enabled on Supabase tables
- 🔒 Email verification required for new accounts

## [Unreleased]

### Planned Features
- 🚀 Push notifications for order updates
- 🚀 In-app chat between customers and technicians
- 🚀 Payment gateway integration
- 🚀 Advanced search and filters
- 🚀 Technician availability scheduling
- 🚀 Multi-language support (add more languages)
- 🚀 Social media authentication (Google, Facebook, Apple)
- 🚀 Referral program
- 🚀 Loyalty points system

---

## Version History

- **v1.0.0** (2024-12-22) - Initial release with full Supabase integration
