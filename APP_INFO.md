# N Pricing Application Information

## Project Overview
**N Pricing** is a high-performance Pricing Engine for **Funds Transfer Pricing (FTP)**. It is designed to help financial institutions calculate internal transfer rates between different business units, allowing for accurate profitability analysis and risk assessment.

## Key Features
- **Pricing Engine**: Core module for calculating deal prices using various methodologies (Matched Maturity, Rate Card, Moving Average, etc.).
- **Deal Blotter**: A comprehensive list and management system for all recorded deals.
- **Market Data Visualizer**: Real-time visualization of yield curves and base references (e.g., SOFR, ESTR).
- **Behavioural Models**: Advanced modeling for non-deterministic products (e.g., mortgages with prepayment options).
- **Accounting Ledger**: View the financial outcomes and postings of all transactions.
- **Methodology Configuration**: Flexible rule-based system to assign calculation methods based on product, segment, and tenor.
- **AI Intelligence**: Integrated GenAI (Gemini) assistant for market analysis and deal insights.

## Technology Stack
- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Build Tool**: Vite
- **AI Integration**: Google Generative AI (Gemini SDK)

## System Architecture
The application is structured as a single-page application (SPA) with a modular component architecture:
- `App.tsx`: Main dashboard and routing logic.
- `components/Calculator`: Tools for price calculation.
- `components/Blotter`: Transaction management.
- `components/Config`: System settings and rules.
- `components/Intelligence`: AI-powered features.
- `constants.ts`: Mock data and initial configurations.
- `types.ts`: TypeScript interfaces for the entire domain model.

## Future Roadmap
- Implementation of internationalization (English/Spanish).
- Enhanced user management and role-based access control.
- Integration with external market data providers.
- Expanded financial parameters for complex deal structures.
