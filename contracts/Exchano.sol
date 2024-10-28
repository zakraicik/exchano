// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./LPToken.sol"; 

interface IFeeCollector {
    function withdrawFees(address token, uint256 amount) external;
}

contract Exchano {
    uint256 public feeRate; 
    address public owner;
    address public feeCollector;

    struct Pool {
        uint256 totalLiquidity;
        LPToken lpToken;
        uint256 tokenABalance;
        uint256 tokenBBalance;
    }

    mapping(bytes32 => Pool) public liquidityPools;

    constructor(address _feeCollector, uint256 _feeRate) {
        require(_feeCollector != address(0), "Invalid feeCollector address");
        feeCollector = _feeCollector;
        owner = msg.sender;
        feeRate = _feeRate;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

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

    function _initializePool(
        Pool storage pool,
        address token0,
        address token1
    ) private {
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
        pool.tokenABalance = 0;
        pool.tokenBBalance = 0;
    }

    function _calculateLiquidityShare(
        Pool storage pool,
        uint256 amount0,
        uint256 amount1
    ) private view returns (uint256) {
        if (pool.totalLiquidity == 0) {
            return Math.sqrt(amount0 * amount1);
        }

        uint256 share0 = (amount0 * pool.lpToken.totalSupply()) / pool.tokenABalance;
        uint256 share1 = (amount1 * pool.lpToken.totalSupply()) / pool.tokenBBalance;
        
        return Math.min(share0, share1);
    }

    function swap(address _tokenIn, address _tokenOut, uint256 amountIn) public {
        IERC20 tokenIn = IERC20(_tokenIn);
        IERC20 tokenOut = IERC20(_tokenOut);

        require(tokenIn.transferFrom(msg.sender, address(this), amountIn), "Transfer of tokenIn failed");

        uint256 fee = (amountIn * feeRate) / 10000;
        uint256 amountOut = amountIn - fee;

        require(tokenIn.transfer(feeCollector, fee), "Fee transfer failed");

        require(tokenOut.balanceOf(address(this)) >= amountOut, "Insufficient tokenOut in contract");

        require(tokenOut.transfer(msg.sender, amountOut), "Swap failed");
    }

    function addLiquidity(address _tokenA, address _tokenB, uint256 amountA, uint256 amountB) public {
        require(_tokenA != address(0) && _tokenB != address(0), "Invalid token addresses");
        require(amountA > 0 && amountB > 0, "Amounts must be greater than 0");
        require(_tokenA != _tokenB, "Tokens must be different");

        (address tokenA, address tokenB, uint256 amount0, uint256 amount1) = _tokenA < _tokenB 
            ? (_tokenA, _tokenB, amountA, amountB)
            : (_tokenB, _tokenA, amountB, amountA);

        IERC20 token0 = IERC20(tokenA);
        IERC20 token1 = IERC20(tokenB);

        uint256 initialBalance0 = token0.balanceOf(address(this));
        uint256 initialBalance1 = token1.balanceOf(address(this));

        require(token0.transferFrom(msg.sender, address(this), amount0), "Transfer of token0 failed");
        require(token1.transferFrom(msg.sender, address(this), amount1), "Transfer of token1 failed");

        require(
            token0.balanceOf(address(this)) == initialBalance0 + amount0 &&
            token1.balanceOf(address(this)) == initialBalance1 + amount1,
            "Transfer amount mismatch"
        );

        bytes32 pairKey = keccak256(abi.encodePacked(tokenA, tokenB));
        Pool storage pool = liquidityPools[pairKey];

        if (address(pool.lpToken) == address(0)) {
            _initializePool(pool, tokenA, tokenB);
        }

        uint256 liquidityShare = _calculateLiquidityShare(
            pool,
            amount0,
            amount1
        );

        pool.totalLiquidity = pool.totalLiquidity + amount0 + amount1;
        pool.tokenABalance = pool.tokenABalance + amount0;
        pool.tokenBBalance = pool.tokenBBalance + amount1;

        require(liquidityShare > 0, "Insufficient liquidity minted");
        pool.lpToken.mint(msg.sender, liquidityShare);
    }
    
    function withdrawLiquidity(address _tokenA, address _tokenB, uint256 lpTokenAmount) public {
        bytes32 pairKey = keccak256(abi.encodePacked(_tokenA, _tokenB));
        Pool storage pool = liquidityPools[pairKey];

        require(lpTokenAmount > 0, "Invalid amount");
        uint256 totalSupply = pool.lpToken.totalSupply();
        require(lpTokenAmount <= pool.lpToken.balanceOf(msg.sender), "Insufficient lpTokens");

        // Calculate the user's share of TokenA and TokenB
        uint256 tokenAShare = (lpTokenAmount * pool.tokenABalance) / totalSupply;
        uint256 tokenBShare = (lpTokenAmount * pool.tokenBBalance) / totalSupply;

        // Burn the LP tokens
        pool.lpToken.burn(msg.sender, lpTokenAmount);

        // Transfer the proportional share of tokens back to the user
        IERC20(_tokenA).transfer(msg.sender, tokenAShare);
        IERC20(_tokenB).transfer(msg.sender, tokenBShare);

        // Update the pool's total liquidity
        pool.totalLiquidity -= (tokenAShare + tokenBShare);
        pool.tokenABalance -= tokenAShare;
        pool.tokenBBalance -= tokenBShare;
    }

    function withdrawFees(address _token, uint256 amount) public onlyOwner {
        IFeeCollector(feeCollector).withdrawFees(_token, amount);
    }
}
