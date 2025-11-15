# Data Monkey - Agentic Data Marketplace

A modern landing page for Data Monkey, an autonomous marketplace where AI agents discover, negotiate, and purchase high-quality datasets in real-time.

## Features

- **Autonomous Agents**: Buyers deploy agents with goals to automatically find and purchase datasets
- **Quality Scoring**: Every dataset is scored - agents only buy data that meets quality standards
- **Smart Negotiation**: Agents negotiate prices based on urgency, rarity, quality, and market conditions
- **Hot Data Tracking**: Sellers see what's in high demand and can curate datasets accordingly
- **Batch Purchasing**: Agents buy data in small batches, continuously evaluating quality
- **Patient Waiting**: Agents wait for quality data rather than settling for subpar datasets

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the landing page.

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Design System

This landing page uses design tokens from `design.json`:

- **Colors**: Dark theme with mint green accents (#78c8a0) and neon red highlights (#bf2031)
- **Typography**: Inter font family with defined scale (display-xxl, h1, h2, body-lg, body, label)
- **Spacing**: Consistent spacing scale (4px to 80px)
- **Components**: Cards, buttons, and navigation styled according to design tokens

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Navbar.tsx       # Navigation bar
│   │   ├── Hero.tsx         # Hero section with main CTA
│   │   ├── Features.tsx     # Key features overview
│   │   ├── HowItWorks.tsx   # Step-by-step process
│   │   ├── Marketplace.tsx  # Hot data and available datasets
│   │   ├── CTA.tsx          # Call-to-action section
│   │   └── Footer.tsx       # Footer with links
│   ├── App.tsx              # Main app component
│   ├── App.css              # App-level styles
│   ├── index.css            # Global styles and design tokens
│   └── main.tsx             # Entry point
├── index.html
├── package.json
├── vite.config.ts
└── design.json              # Design tokens
```

## Technology Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **CSS** - Styling with design tokens

## Next Steps

This is the landing page only. Future development will include:

- Backend API for marketplace operations
- Agent deployment interface
- Seller dashboard
- Buyer agent configuration
- Real-time data quality scoring
- Payment integration (x402 protocol)
- Agent negotiation engine

## License

MIT

