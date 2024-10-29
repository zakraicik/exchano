# Exchano Protocol

## Table of Contents

1. [Overview](#overview)
2. [Core Components](#core-components)
3. [Protocol Mechanics](#protocol-mechanics)
4. [Pool Management](#pool-management)
5. [Trading Mechanics](#trading-mechanics)
6. [Fee System](#fee-system)
7. [Security Features](#security-features)
8. [Mathematical Formulas](#mathematical-formulas)
9. [Example Scenarios](#example-scenarios)

## Overview

Exchano is a decentralized exchange protocol implementing an automated market maker (AMM) with constant product formula (x \* y = k). It features:

- Multi-pool token swapping
- Proportional fee distribution
- Advanced liquidity provider incentives
- Permanent minimum liquidity mechanism
- Cross-pool fee sharing

## Core Components

### 1. Exchange Contract (Exchano.sol)

- Primary contract handling:
  - Token swaps
  - Liquidity provision/removal
  - Fee collection
  - Pool initialization
  - Share calculations
- Implements constant product formula
- Manages LP token minting/burning
- Controls pool parameters

### 2. Fee Collector Contract (FeeCollector.sol)

- Dedicated fee management contract
- Responsibilities:
  - Fee accumulation per token
  - Share tracking per user
  - Fee distribution
  - Cross-pool share calculations
- Features:
  - Non-reentrant withdrawals
  - Same-block protection
  - Owner-only recovery function

### 3. LP Token Contract (LPToken.sol)

- Standard ERC20 implementation
- Represents pool shares
- Minted/burned by main contract
- Used for fee share calculations

## Protocol Mechanics

### Constants and Parameters

```solidity
MAX_FEE_RATE = 1000         // 10% maximum fee (basis points)
MINIMUM_LIQUIDITY = 1000     // Minimum locked liquidity
BASIS_POINTS = 10000         // Precision for calculations
```

### Pool Initialization Process

1. First deposit triggers pool creation
2. LP token contract deployed with unique name/symbol
3. Minimum liquidity locked permanently
4. Initial price ratio established

### Liquidity Provider Mechanics

#### First Provider:

1. Deposits tokens A and B
2. LP tokens minted = sqrt(amountA \* amountB) - MINIMUM_LIQUIDITY
3. Sets initial exchange rate
4. MINIMUM_LIQUIDITY tokens locked at address(1)

#### Subsequent Providers:

1. Must match current pool ratio
2. LP tokens minted = min((dx _ L) / X, (dy _ L) / Y)
   - dx, dy: deposit amounts
   - L: total LP supply
   - X, Y: pool balances
3. Share updated in fee collector

## Pool Management

### Pool State

```solidity
struct Pool {
    uint256 totalLiquidity;      // Total tokens locked
    LPToken lpToken;             // LP token contract
    uint256 tokenABalance;       // Balance of token A
    uint256 tokenBBalance;       // Balance of token B
    uint256 lastBlockUpdated;    // Anti-flash loan protection
    bool isInitialized;          // Pool existence flag
}
```

### Liquidity Management

#### Adding Liquidity

```solidity
function addLiquidity(
    address tokenA,
    address tokenB,
    uint256 amountA,
    uint256 amountB,
    uint256 minLPTokens
) external returns (uint256)
```

Process:

1. Validate inputs and pool state
2. Calculate optimal amounts
3. Transfer tokens
4. Mint LP tokens
5. Update shares
6. Emit events

#### Removing Liquidity

```solidity
function withdrawLiquidity(
    address tokenA,
    address tokenB,
    uint256 lpTokenAmount,
    uint256 minAmountA,
    uint256 minAmountB
) external
```

Process:

1. Calculate token amounts
2. Burn LP tokens
3. Transfer tokens
4. Update shares
5. Emit events

## Trading Mechanics

### Swap Function

```solidity
function swap(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
) external returns (uint256)
```

### Swap Process

1. Validate inputs
2. Calculate output amount using formula:
   ```
   amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
   ```
3. Apply fees:
   ```
   amountInWithFee = amountIn * (BASIS_POINTS - feeRate)
   ```
4. Verify k value:
   ```
   require(newK >= oldK, "k value protection")
   ```
5. Update balances
6. Transfer tokens
7. Process fees

### Price Impact Protection

- Minimum output amount check
- K-value verification
- Slippage tolerance
- Reserve checks

## Fee System

### Fee Collection

1. Fees collected in input token
2. Percentage defined by feeRate (max 10%)
3. Sent to FeeCollector contract
4. Accumulated per token

### Share Calculation

```solidity
userShare = (userLPBalance * BASIS_POINTS) / totalLPSupply
```

### Fee Distribution

1. Users claim fees per token
2. Highest share across pools used
3. Fees calculated:
   ```
   userFees = (totalFees * shareInBasisPoints) / BASIS_POINTS
   ```

### Cross-Pool Fee Sharing

- Track shares across all pools
- Use highest share for withdrawals
- Update shares on liquidity changes
- Prevent double-counting

## Security Features

### Anti-Flash Loan Protection

- Same block protection
- K-value verification
- Minimum liquidity lock

### Share Manipulation Prevention

- Non-reentrant functions
- Share updates per block
- Maximum share checks

### Value Protection

- Minimum output amounts
- Slippage checks
- Balance verifications

## Mathematical Formulas

### Constant Product Formula

```
x * y = k
(x + Δx) * (y - Δy) = k
```

### LP Token Minting

First provider:

```
tokens = sqrt(amountA * amountB) - MINIMUM_LIQUIDITY
```

Subsequent providers:

```
tokens = min((amountA * totalSupply) / reserveA,
            (amountB * totalSupply) / reserveB)
```

### Output Amount Calculation

```
amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
```

### Fee Calculation

```
fee = amountIn * feeRate / BASIS_POINTS
effectiveInput = amountIn - fee
```

## Example Scenarios

### Liquidity Provision Example

```
Initial State:
- Empty pool
- User deposits: 100,000 tokenA, 200,000 tokenB
- LP tokens = sqrt(100,000 * 200,000) - 1,000 = 140,421
- User share = 140,421 / 141,421 ≈ 99.29%

Second Provider:
- Pool: 100,000 tokenA, 200,000 tokenB
- Deposits: 50,000 tokenA, 100,000 tokenB
- LP tokens = min(
    (50,000 * 141,421) / 100,000,
    (100,000 * 141,421) / 200,000
  ) = 70,710
- New shares: 66.5% : 33.5%
```

### Trading Example

```
Pool State:
- 100,000 tokenA
- 200,000 tokenB
- K = 20,000,000,000

Trade:
- Input: 1,000 tokenA
- Fee: 10 tokenA (1%)
- Effective input: 990 tokenA
- Output = (990 * 200,000) / (100,000 + 990) ≈ 1,960 tokenB
```

### Fee Distribution Example

```
User Positions:
- Pool A (Token X/Y): 30% share
- Pool B (Token Y/Z): 20% share
- Pool C (Token Y/W): 25% share

Fee Withdrawal for Token Y:
- Highest share: 30% (Pool A)
- Accumulated fees: 1,000 Token Y
- User receives: 300 Token Y
```

### Managing Multiple Pools

- Share updates in all pools
- K-value maintained independently
- Fees collected per token
- Shares tracked per user per token

This documentation aims to provide a comprehensive understanding of the Exchano protocol mechanics. For implementation details, please refer to the source code and comments in the respective contract files.
