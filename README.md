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

## Key Features

### Trading

- Automated Market Making using constant product formula
- Configurable trading fees (up to 10%)
- Slippage protection
- Same-block protection against manipulation

### Liquidity Provision

- Add liquidity to create new pools or join existing ones
- Withdraw liquidity with underlying assets
- Minimum liquidity lock to prevent precision issues
- LP tokens represent pool shares

### Fee System

- Fees collected only on input tokens during swaps
- Fee distribution based on highest pool share
- Proportional share calculation using basis points (1/10000)

## Core Mechanics

### Pool Creation

```solidity
function addLiquidity(
    address tokenA,
    address tokenB,
    uint256 amountA,
    uint256 amountB,
    uint256 minLPTokens
) external returns (uint256 liquidityShare)
```

- First liquidity provider sets the initial price
- Minimum liquidity locked forever
- LP tokens minted proportional to contribution

### Trading

```solidity
function swap(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
) external returns (uint256 amountOut)
```

- Uses constant product formula: (x + Δx)(y - Δy) = xy
- Fees deducted from input amount
- Fees sent to FeeCollector
- Updates LP shares in fee collector for the input token

### Fee Distribution

```solidity
function withdrawFees(
    address token
) external
```

- Users can withdraw fees for any token they've provided liquidity for
- Share calculation based on highest ownership percentage across all pools containing the token
- Prevents double-counting of shares across multiple pools

## Share Calculation Example

1. User has LP tokens in two pools:
   - USDC/ETH pool: 20% of pool
   - USDC/DAI pool: 15% of pool
2. When withdrawing USDC fees, user receives based on 20% share (highest across pools)

## Security Features

### Access Control

- `onlyOwner`: Administrative functions
- `nonReentrant`: Prevents reentrancy attacks
- `whenNotPaused`: Emergency stop capability

### Safety Measures

- Slippage protection in swaps and liquidity removal
- Same-block protection against manipulation
- Checks-effects-interactions pattern
- Two-step ownership transfers

## Events

```solidity
event LiquidityAdded(address user, address tokenA, address tokenB, uint256 amountA, uint256 amountB, uint256 lpTokensMinted);
event LiquidityRemoved(address user, address tokenA, address tokenB, uint256 amountA, uint256 amountB, uint256 lpTokensBurned);
event Swap(address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 fee);
event FeesWithdrawn(address user, address token, uint256 amount);
```

## Constants

```solidity
MAX_FEE_RATE = 1000     // 10% maximum fee
MINIMUM_LIQUIDITY = 1000 // Locked liquidity
BASIS_POINTS = 10000     // Share calculation denominator
```

## Integration Guide

### Adding Liquidity

1. Approve token transfers to Exchano contract
2. Call addLiquidity with desired amounts
3. Receive LP tokens representing pool share

### Trading

1. Approve tokenIn transfer to Exchano contract
2. Calculate minimum output amount (slippage tolerance)
3. Call swap function

### Collecting Fees

1. Accumulate fees by providing liquidity
2. Call withdrawFees for specific token
3. Receive proportional share of collected fees

## Error Handling

The contract includes comprehensive error messages for common failure cases:

- Insufficient liquidity
- Slippage tolerance exceeded
- Invalid token addresses
- Insufficient balances
- Zero amount transfers

## Security Considerations

- No external calls in core functions except token transfers
- Reentrancy protection on all state-modifying functions
- Pause mechanism for emergency situations
- Mathematical operations protected against overflow
- Share calculations protected against manipulation

## Upgradeability

The contract is not upgradeable. Any changes require deployment of a new version and migration of liquidity.

## License

MIT License
