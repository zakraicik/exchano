# Exchano Protocol

## Overview

Exchano is a decentralized exchange protocol implementing an automated market maker (AMM) with constant product formula (x \* y = k) and a unique fee distribution system. The protocol enables token swaps, liquidity provision, and proportional fee sharing among liquidity providers.

## Core Components

### 1. Exchange Contract (Exchano.sol)

The main contract handling swaps, liquidity provision, and fee collection.

### 2. Fee Collector Contract (FeeCollector.sol)

A separate contract managing fee accumulation and distribution to liquidity providers.

### 3. LP Token Contract (LPToken.sol)

ERC20 tokens representing liquidity provider shares in pools.

## Liquidity Management

### Initial Liquidity Provision

When a new pool is created:

1. First depositor sets the initial price ratio between tokens
2. Liquidity tokens minted = sqrt(amountA \* amountB) - MINIMUM_LIQUIDITY
3. MINIMUM_LIQUIDITY (1000) tokens are permanently locked by sending to address(1)
4. Initial depositor receives remaining LP tokens

### Subsequent Liquidity Additions

For subsequent deposits:

1. LP tokens minted = min((dx _ L) / X, (dy _ L) / Y)
   - dx, dy: amounts of tokens being added
   - L: total supply of LP tokens
   - X, Y: current pool balances
2. Must maintain the existing pool ratio to prevent value loss

### Minimum Liquidity Mechanism

- Purpose: Prevents precision loss and division by zero
- Amount: 1000 LP tokens (MINIMUM_LIQUIDITY constant)
- Implementation:
  - Locked permanently in first deposit
  - Cannot be withdrawn
  - Ensures pool always has some baseline liquidity
  - Protects against mathematical edge cases

### Share Calculation

1. Within Single Pool:

   ```
   userShare = userLPBalance / totalLPSupply
   ```

   - Includes MINIMUM_LIQUIDITY in totalLPSupply
   - Actual share slightly lower due to locked minimum

2. Across Multiple Pools:
   ```
   effectiveShare = highestShareAcrossPoolsWithToken * BASIS_POINTS
   ```
   - BASIS_POINTS = 10000 (100%)
   - Prevents share dilution across pools

### Liquidity Removal

1. Calculate token amounts:
   ```
   tokenAmount = (lpTokensBurned * poolBalance) / totalLPSupply
   ```
2. Burn LP tokens
3. Transfer underlying tokens
4. Update fee collector shares

### Impact of Minimum Liquidity

#### Mathematical Impact

- Actual user share = userLPBalance / (totalLPSupply + MINIMUM_LIQUIDITY)
- Example:
  - User deposits 100,000 of each token
  - LP tokens minted ≈ 99,000 (100,000 - 1,000)
  - Initial share ≈ 99% instead of 100%

#### Pool Operations

1. New Pool Creation:

   - Must deposit enough to generate > MINIMUM_LIQUIDITY tokens
   - Initial price ratio remains intact
   - Small portion of value locked permanently

2. Trading:

   - Minimum liquidity ensures k > 0
   - Prevents extreme price manipulation
   - Maintains reasonable slippage bounds

3. Full Withdrawal:
   - Cannot remove 100% of liquidity
   - MINIMUM_LIQUIDITY tokens remain
   - Pool remains functional with baseline liquidity

## Fee Distribution with Liquidity Shares

### Fee Accumulation

1. Trading fees collected in input token
2. Sent to FeeCollector contract
3. Tracked per token, not per pool

### Share Updates

1. Triggered on:
   - Liquidity addition
   - Liquidity removal
   - Pool rebalancing
2. Formula:
   ```solidity
   newShareBasisPoints = (userLPBalance * BASIS_POINTS) / totalLPSupply
   ```

### Fee Withdrawal Process

1. Calculate highest share across all pools with token
2. Apply share to total accumulated fees
3. Reset user's accumulator
4. Transfer fees to user

## Security Considerations

### Share Manipulation Protection

- Same-block protection prevents flash loan attacks
- Minimum liquidity prevents share inflation
- Basis points system prevents precision loss

### Share Calculation Safety

- SafeMath for overflow protection
- Proper decimal handling
- Non-reentrant fee withdrawals

## Example Scenarios

### Single Pool

```
Initial Deposit:
- Deposit: 100,000 tokens each
- LP tokens: 99,000 (100,000 - MINIMUM_LIQUIDITY)
- Share: 99%

Second Deposit:
- Deposit: 50,000 tokens each
- LP tokens: ≈ 49,500
- New share distribution: 66.6% : 33.3%
```

### Multiple Pools

```
User has:
- Pool A: 30% share (Token X/Y)
- Pool B: 20% share (Token Y/Z)
When withdrawing Token Y fees:
- Effective share = 30% (highest share)
```
