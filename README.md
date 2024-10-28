# Exchano Protocol

Exchano is a decentralized exchange protocol implementing an Automated Market Maker (AMM) model with liquidity pools. The protocol enables permissionless trading of ERC20 tokens while incentivizing liquidity providers through trading fees.

## Core Mechanics

### Liquidity Pools

- Each pool consists of a pair of ERC20 tokens
- Pools maintain a constant product formula (x \* y = k)
- Minimum liquidity is locked forever to prevent the first LP from draining the pool
- Each pool has its own LP token representing proportional ownership

### LP Tokens

- Minted when liquidity is added to a pool
- Can be burned to withdraw underlying assets
- LP token name format: "Exchano LP Token [Token A Address]/[Token B Address]"
- LP token symbol format: "ELP-[Token A Address]-[Token B Address]"

### Trading Mechanics

- Uses constant product formula (x \* y = k)
- Includes slippage protection via minimum output amounts
- Same-block trading protection to prevent sandwich attacks
- Trading fees are collected in the input token

### Fee Structure

- Configurable fee rate (maximum 10% or 1000 basis points)
- Fees are collected in the input token during swaps
- Fees are sent to a fee collector contract
- LP token holders can withdraw their proportional share of fees

## Core Functions

### Adding Liquidity

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
- Subsequent providers must add proportional amounts
- Minimum LP tokens parameter protects against front-running
- Returns LP tokens representing pool share

### Removing Liquidity

```solidity
function withdrawLiquidity(
    address tokenA,
    address tokenB,
    uint256 lpTokenAmount,
    uint256 minAmountA,
    uint256 minAmountB
) external
```

- Burns LP tokens to withdraw underlying assets
- Proportional withdrawal based on pool share
- Includes slippage protection via minimum amounts
- Updates pool balances accordingly

### Trading

```solidity
function swap(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
) external returns (uint256 amountOut)
```

- Swaps one token for another using the constant product formula
- Includes slippage protection via minimum output
- Collects trading fees in input token
- Returns actual output amount

### Fee Collection

```solidity
function withdrawFees(
    address token,
    uint256 amount
) external
```

- LP token holders can withdraw their share of collected fees
- Share is proportional to LP token holdings
- Fees are withdrawn from the fee collector contract

## Security Features

1. **Reentrancy Protection**

   - All external functions use ReentrancyGuard
   - Uses checks-effects-interactions pattern

2. **Slippage Protection**

   - Minimum output amounts for swaps
   - Minimum LP tokens for liquidity provision
   - Minimum token amounts for liquidity withdrawal

3. **Flash Loan Prevention**

   - Same block trading protection
   - Constant product (k) value protection

4. **Safe Token Transfers**

   - Uses OpenZeppelin's SafeERC20
   - Handles non-standard ERC20 implementations

5. **Access Control**
   - Owner can only update fee rates and collector address
   - Two-step ownership transfer process

## Events

The protocol emits events for all major actions:

- `LiquidityAdded`
- `LiquidityRemoved`
- `Swap`
- `FeesWithdrawn`
- `FeeCollectorUpdated`
- `FeeRateUpdated`
- `PoolInitialized`

## Dependencies

The protocol relies on several OpenZeppelin contracts:

- `@openzeppelin/contracts/token/ERC20/IERC20.sol`
- `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol`
- `@openzeppelin/contracts/utils/math/Math.sol`
- `@openzeppelin/contracts/utils/ReentrancyGuard.sol`
- `@openzeppelin/contracts/access/Ownable2Step.sol`

## Installation and Usage

1. Install dependencies:

```bash
npm install @openzeppelin/contracts
```

2. Deploy FeeCollector contract first

3. Deploy Exchano contract with:

   - Fee collector address
   - Initial fee rate (in basis points)

4. Interact with the contract through the provided functions

## Testing

Comprehensive tests are provided covering:

- Deployment scenarios
- Liquidity provision and removal
- Trading mechanics
- Fee collection
- Edge cases and error conditions

Run tests:

```bash
npx hardhat test
```

## License

MIT
