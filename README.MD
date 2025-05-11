
HVZ6hZAfRhGgRRvQ5oKkXJJEd1Wji3bAVkXQDk1ZRuc8
do not send amount in decimal to the swap api, send the whole value


# SOLPay

> Accept any Solana token, receive USDC — Seamless crypto payments for merchants and customers.

![Solana Payment Gateway](https://img.shields.io/badge/SOLPay-Payment_Gateway-00FFBD)

## Overview

SOLPay is a flexible payment gateway built on Solana that solves the token fragmentation problem. Customers can pay with any token in their wallet while merchants receive stable USDC, making crypto payments practical for everyday commerce.

## Key Features

- **Universal Token Acceptance**: Accept SOL, USDC, BONK, SAMO, and any other SPL token
- **Guaranteed USDC Settlement**: Merchants always receive USDC regardless of payment method
- **Real-time Price Conversion**: Powered by Jupiter Aggregator API
- **Wallet Detection**: Automatically displays tokens available in customer wallets
- **Transaction Tracking**: Monitor payment status with explorer integration
- **DevNet Support**: Fully functional testing environment

## Quick Start

### For Customers
1. Enter payment amount in USD
2. Select your preferred payment token from your wallet
3. Connect your Solana wallet (Phantom, Solflare, etc.)
4. Approve the transaction

### For Merchants
1. Share your SOLPay payment URL with customers
2. Receive USDC directly to your wallet address
3. No need to handle multiple tokens or conversions

## Technical Architecture

SOLPay consists of:

1. **Next.js Frontend**: Clean, responsive UI with Solana wallet integration
2. **Solana Program**: Manages escrow and payment verification
3. **Token Conversion Layer**: Interfaces with Jupiter for optimal swaps
4. **Transaction Monitoring**: Real-time transaction status updates

## Setup & Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/solpay.git
cd solpay
npm install
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables in .env.local
```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

4. Run the development server
```bash
npm run dev
```