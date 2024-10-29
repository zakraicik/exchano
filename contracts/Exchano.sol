// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./LPToken.sol";

interface IFeeCollector {
    function withdrawUserFees(
        address user,
        address token,
        uint256 shareInBasisPoints
    ) external;

    function getUserFeesForToken(
        address user,
        address token
    ) external view returns (uint256);

    function receiveFees(address token, uint256 amount) external;
    
    function updateUserShare(
        address user,
        address token,
        uint256 newShareBasisPoints
    ) external;
}

/**
 * @title Exchano
 * @notice A decentralized exchange implementation with automated market maker functionality
 * @dev Implements pool-based swapping with constant product formula and fee distribution
 */
contract Exchano is ReentrancyGuard, Ownable2Step, Pausable {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_FEE_RATE = 1000; // 10% max fee (basis points)
    uint256 public constant MINIMUM_LIQUIDITY = 1000; // Minimum liquidity to prevent precision loss
    uint256 public constant BASIS_POINTS = 10000; // For fee calculations

    uint256 public feeRate;
    address public feeCollector;
    
    struct Pool {
        uint256 totalLiquidity;
        LPToken lpToken;
        uint256 tokenABalance;
        uint256 tokenBBalance;
        uint256 lastBlockUpdated;
        bool isInitialized;
        
    }

    // Mappings
    mapping(bytes32 => Pool) public liquidityPools;
    mapping(address => bytes32[]) public tokenPools;
    mapping(bytes32 => uint256) public constant_k;

    // Events
    event LiquidityAdded(
        address indexed user,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 lpTokensMinted
    );

    event LiquidityRemoved(
        address indexed user,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 lpTokensBurned
    );

    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );

    event FeeCollectorUpdated(
        address indexed oldCollector,
        address indexed newCollector
    );

    event FeeRateUpdated(
        uint256 oldRate,
        uint256 newRate
    );

    event PoolInitialized(
        address indexed tokenA,
        address indexed tokenB,
        address lpToken
    );

    event FeesWithdrawn(
        address indexed user,
        address indexed token,
        uint256 amount
    );

    event SharesUpdated(
        address indexed user,
        address indexed token,
        uint256 newShare
    );

    /**
     * @notice Contract constructor
     * @param _feeCollector Address that will receive trading fees
     * @param _feeRate Initial fee rate in basis points (100 = 1%)
     */
    constructor(address _feeCollector, uint256 _feeRate) Ownable(msg.sender) {
        require(_feeCollector != address(0), "Exchano: zero address collector");
        require(_feeRate <= MAX_FEE_RATE, "Exchano: fee rate exceeds maximum");
        
        feeCollector = _feeCollector;
        feeRate = _feeRate;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Updates LP token holder shares in the fee collector
     * @param pool Pool to update shares for
     * @param token Token to update shares for
     * @param user User address to update
     */
   function _updateUserShare(
        Pool storage pool,
        address token,
        address user
    ) private {
        uint256 totalSupply = pool.lpToken.totalSupply();
        if (totalSupply > 0) {
            uint256 userBalance = pool.lpToken.balanceOf(user);
            uint256 shareInBasisPoints = (userBalance * BASIS_POINTS) / totalSupply;
            IFeeCollector(feeCollector).updateUserShare(user, token, shareInBasisPoints);
            emit SharesUpdated(user, token, shareInBasisPoints);
        }
    }

    /**
     * @notice Converts an address to its hex string representation
     * @param _addr Address to convert
     * @return Hex string representation of the address
     */
    function _toHexString(address _addr) private pure returns (string memory) {
        bytes20 addrBytes = bytes20(_addr);
        bytes memory hexChars = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        
        for (uint i = 0; i < 20; i++) {
            str[2 + i * 2] = hexChars[uint8(addrBytes[i] >> 4)];
            str[3 + i * 2] = hexChars[uint8(addrBytes[i] & 0x0f)];
        }
        return string(str);
    }

    /**
     * @notice Initializes a new liquidity pool
     * @param pool Storage reference to the pool
     * @param token0 First token in the pair
     * @param token1 Second token in the pair
     */
       function _initializePool(
        Pool storage pool,
        address token0,
        address token1
    ) private {
        require(!pool.isInitialized, "Exchano: pool already initialized");
        
        string memory name = string(abi.encodePacked(
            "Exchano LP Token ",
            _toHexString(token0),
            "/",
            _toHexString(token1)
        ));
        
        string memory symbol = string(abi.encodePacked(
            "ELP-",
            _toHexString(token0),
            "-",
            _toHexString(token1)
        ));

        pool.lpToken = new LPToken(name, symbol, address(this));
        pool.lastBlockUpdated = block.number;
        pool.isInitialized = true;

        // Add new pool tracking
        bytes32 pairKey = keccak256(abi.encodePacked(token0, token1));
        tokenPools[token0].push(pairKey);
        tokenPools[token1].push(pairKey);

        emit PoolInitialized(token0, token1, address(pool.lpToken));
    }

    /**
     * @notice Updates the fee collector address
     * @param _newFeeCollector New fee collector address
     */
    function setFeeCollector(address _newFeeCollector) external onlyOwner {
        require(_newFeeCollector != address(0), "Exchano: zero address collector");
        
        // Try to validate the new fee collector
        try IFeeCollector(_newFeeCollector).receiveFees(address(0), 0) {
            revert("Exchano: invalid fee collector");
        } catch {
            address oldCollector = feeCollector;
            feeCollector = _newFeeCollector;
            emit FeeCollectorUpdated(oldCollector, _newFeeCollector);
        }
    }

    /**
     * @notice Updates the fee rate
     * @param _newFeeRate New fee rate in basis points
     */
    function setFeeRate(uint256 _newFeeRate) external onlyOwner {
        require(_newFeeRate <= MAX_FEE_RATE, "Exchano: fee rate exceeds maximum");
        uint256 oldRate = feeRate;
        feeRate = _newFeeRate;
        emit FeeRateUpdated(oldRate, _newFeeRate);
    }

    /**
     * @notice Returns pool information for a token pair
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return tokenABalance The balance of token A in the pool
     * @return tokenBBalance The balance of token B in the pool
     * @return totalLiquidity The total liquidity in the pool
     * @return lpToken The address of the LP token contract
     * @return isInitialized Whether the pool has been initialized
     */
    function getPool(address tokenA, address tokenB) 
        external 
        view 
        returns (
            uint256 tokenABalance,
            uint256 tokenBBalance,
            uint256 totalLiquidity,
            address lpToken,
            bool isInitialized
        ) 
    {
        (address token0, address token1) = tokenA < tokenB 
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        
        bytes32 pairKey = keccak256(abi.encodePacked(token0, token1));
        Pool storage pool = liquidityPools[pairKey];
        
        return (
            pool.tokenABalance,
            pool.tokenBBalance,
            pool.totalLiquidity,
            address(pool.lpToken),
            pool.isInitialized
        );
    }

    /**
     * @notice Executes a token swap
     * @param _tokenIn Address of token being sent
     * @param _tokenOut Address of token being received
     * @param amountIn Amount of input token
     * @param minAmountOut Minimum amount of output token to receive
     * @return amountOut Amount of output token received
     */
         function swap(
        address _tokenIn,
        address _tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        require(_tokenIn != _tokenOut, "Exchano: identical tokens");
        require(amountIn > 0, "Exchano: zero input amount");

        (address token0, address token1) = _tokenIn < _tokenOut 
            ? (_tokenIn, _tokenOut)
            : (_tokenOut, _tokenIn);
        
        bytes32 pairKey = keccak256(abi.encodePacked(token0, token1));
        Pool storage pool = liquidityPools[pairKey];
        
        require(pool.isInitialized, "Exchano: pool not initialized");
        require(pool.lastBlockUpdated < block.number, "Exchano: same block protection");
        
        pool.lastBlockUpdated = block.number;

        (uint256 reserveIn, uint256 reserveOut) = _tokenIn < _tokenOut
            ? (pool.tokenABalance, pool.tokenBBalance)
            : (pool.tokenBBalance, pool.tokenABalance);

        require(reserveIn > 0 && reserveOut > 0, "Exchano: insufficient liquidity");

        uint256 oldK = constant_k[pairKey];
        if (oldK == 0) {
            oldK = reserveIn * reserveOut;
            constant_k[pairKey] = oldK;
        }

        uint256 amountInWithFee = amountIn * (BASIS_POINTS - feeRate);
        amountOut = (amountInWithFee * reserveOut) / ((reserveIn * BASIS_POINTS) + amountInWithFee);
        
        require(amountOut >= minAmountOut, "Exchano: insufficient output amount");
        require(amountOut < reserveOut, "Exchano: insufficient output reserve");

        if (_tokenIn < _tokenOut) {
            pool.tokenABalance += amountIn;
            pool.tokenBBalance -= amountOut;
        } else {
            pool.tokenBBalance += amountIn;
            pool.tokenABalance -= amountOut;
        }

        uint256 newK = pool.tokenABalance * pool.tokenBBalance;
        require(newK >= oldK, "Exchano: k value protection");
        constant_k[pairKey] = newK;

        // Handle token transfers and fees
        IERC20(_tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        uint256 fee = (amountIn * feeRate) / BASIS_POINTS;
        if (fee > 0) {
            // Transfer fee to collector
            IERC20(_tokenIn).safeTransfer(feeCollector, fee);
            
            // Notify fee collector and update share for input token only
            IFeeCollector(feeCollector).receiveFees(_tokenIn, fee);
            _updateUserShare(pool, _tokenIn, msg.sender);
        }
        
        IERC20(_tokenOut).safeTransfer(msg.sender, amountOut);

        emit Swap(msg.sender, _tokenIn, _tokenOut, amountIn, amountOut, fee);

        return amountOut;
    }

    function addLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 minLPTokens
    ) external nonReentrant whenNotPaused returns (uint256 liquidityShare) {
        require(_tokenA != address(0) && _tokenB != address(0), "Exchano: zero address token");
        require(amountA > 0 && amountB > 0, "Exchano: zero amounts");
        require(_tokenA != _tokenB, "Exchano: identical tokens");

        (address token0, address token1, uint256 amount0, uint256 amount1) = _tokenA < _tokenB 
            ? (_tokenA, _tokenB, amountA, amountB)
            : (_tokenB, _tokenA, amountB, amountA);

        bytes32 pairKey = keccak256(abi.encodePacked(token0, token1));
        Pool storage pool = liquidityPools[pairKey];

        if (!pool.isInitialized) {
            _initializePool(pool, token0, token1);
        }

        uint256 _totalSupply = pool.lpToken.totalSupply();
        
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);

        if (_totalSupply == 0) {
            liquidityShare = Math.sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            pool.lpToken.mint(address(1), MINIMUM_LIQUIDITY); // Lock minimum liquidity
            _totalSupply = MINIMUM_LIQUIDITY; // Update total supply to include minimum liquidity
        } else {
            liquidityShare = Math.min(
                (amount0 * _totalSupply) / pool.tokenABalance,
                (amount1 * _totalSupply) / pool.tokenBBalance
            );
        }

        require(liquidityShare >= minLPTokens, "Exchano: insufficient LP tokens");

        // Update state
        pool.totalLiquidity = pool.totalLiquidity + amount0 + amount1;
        pool.tokenABalance += amount0;
        pool.tokenBBalance += amount1;
        pool.lastBlockUpdated = block.number;

        pool.lpToken.mint(msg.sender, liquidityShare);

        // Calculate share with updated total supply
        uint256 userShare = (liquidityShare * BASIS_POINTS) / (liquidityShare + _totalSupply);

        IFeeCollector(feeCollector).updateUserShare(msg.sender, token0, userShare);
        IFeeCollector(feeCollector).updateUserShare(msg.sender, token1, userShare);

        emit LiquidityAdded(msg.sender, token0, token1, amount0, amount1, liquidityShare);

        return liquidityShare;
    }
    
    /**
     * @notice Removes liquidity from a pool and receives underlying tokens
     * @param _tokenA First token address
     * @param _tokenB Second token address
     * @param lpTokenAmount Amount of LP tokens to burn
     * @param minAmountA Minimum amount of token A to receive (slippage protection)
     * @param minAmountB Minimum amount of token B to receive (slippage protection)
     */

    function withdrawLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 lpTokenAmount,
        uint256 minAmountA,
        uint256 minAmountB
    ) external nonReentrant {
        require(_tokenA != address(0) && _tokenB != address(0), "Exchano: zero address token");
        require(lpTokenAmount > 0, "Exchano: zero LP amount");
        
        // Order tokens for consistent pool key
        (address token0, address token1) = _tokenA < _tokenB 
            ? (_tokenA, _tokenB)
            : (_tokenB, _tokenA);
            
        bytes32 pairKey = keccak256(abi.encodePacked(token0, token1));
        Pool storage pool = liquidityPools[pairKey];
        
        require(pool.isInitialized, "Exchano: pool not initialized");
        require(pool.lastBlockUpdated < block.number, "Exchano: same block protection");
        require(lpTokenAmount <= pool.lpToken.balanceOf(msg.sender), "Exchano: insufficient LP tokens");

        // Calculate shares
        uint256 totalSupply = pool.lpToken.totalSupply();
        uint256 token0Share = (lpTokenAmount * pool.tokenABalance) / totalSupply;
        uint256 token1Share = (lpTokenAmount * pool.tokenBBalance) / totalSupply;

        // Slippage protection
        if (_tokenA < _tokenB) {
            require(token0Share >= minAmountA, "Exchano: insufficient token A output");
            require(token1Share >= minAmountB, "Exchano: insufficient token B output");
        } else {
            require(token1Share >= minAmountA, "Exchano: insufficient token A output");
            require(token0Share >= minAmountB, "Exchano: insufficient token B output");
        }

        // Update state (checks-effects-interactions pattern)
        pool.tokenABalance -= token0Share;
        pool.tokenBBalance -= token1Share;
        pool.totalLiquidity -= (token0Share + token1Share);
        pool.lastBlockUpdated = block.number;
        
        // Burn LP tokens before transfer (prevents reentrancy)
        pool.lpToken.burn(msg.sender, lpTokenAmount);

        // Safe transfers using SafeERC20
        IERC20(token0).safeTransfer(msg.sender, token0Share);
        IERC20(token1).safeTransfer(msg.sender, token1Share);

        emit LiquidityRemoved(
            msg.sender,
            token0,
            token1,
            token0Share,
            token1Share,
            lpTokenAmount
        );
    }

    /**
     * @notice Allows LP token holders to withdraw their share of accumulated fees
     * @param token Token to withdraw fees for
     */
    function withdrawFees(
        address token
    ) external nonReentrant whenNotPaused {
        require(token != address(0), "Exchano: zero address token");
        bytes32[] memory poolsWithToken = tokenPools[token];
        require(poolsWithToken.length > 0, "Exchano: token not in any pool");
        
        uint256 highestShare = 0;
        
        // Find the highest share across all pools containing this token
        for (uint256 i = 0; i < poolsWithToken.length; i++) {
            Pool storage pool = liquidityPools[poolsWithToken[i]];
            if (!pool.isInitialized) continue;
            
            uint256 userLPBalance = pool.lpToken.balanceOf(msg.sender);
            if (userLPBalance == 0) continue;
            
            uint256 totalSupply = pool.lpToken.totalSupply();
            uint256 shareInBasisPoints = (userLPBalance * BASIS_POINTS) / totalSupply;
            
            if (shareInBasisPoints > highestShare) {
                highestShare = shareInBasisPoints;
            }
        }
        
        require(highestShare > 0, "Exchano: no share in any pool");

        // Call fee collector to process the withdrawal using highest share
        IFeeCollector(feeCollector).withdrawUserFees(
            msg.sender,
            token,
            highestShare
        );

        emit FeesWithdrawn(msg.sender, token, highestShare);
    }
}
