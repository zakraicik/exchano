// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LPToken.sol"; 

interface IFeeCollector {
    function withdrawFees(address token, uint256 amount) external;
}

contract TokenFlow {
    uint256 public feeRate; 
    uint256 public totalLiquidity;
    address public owner;
    address public feeCollector;
    LPToken public lpToken;

    constructor(address _lpTokenAddress, address _feeCollector, uint256 _feeRate) {
        require(_feeCollector != address(0), "Invalid feeCollector address");
        require(_lpTokenAddress != address(0), "Invalid LP Token address");
        feeCollector = _feeCollector;
        lpToken = LPToken(_lpTokenAddress);
        owner = msg.sender;
        feeRate = _feeRate;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
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
        //Continuous Distribution Model
        
        IERC20 tokenA = IERC20(_tokenA);
        IERC20 tokenB = IERC20(_tokenB);

        require(tokenA.transferFrom(msg.sender, address(this), amountA), "Transfer of token A failed");
        require(tokenB.transferFrom(msg.sender, address(this), amountB), "Transfer of token B failed");

        uint256 liquidityShare;

        if (totalLiquidity == 0) {
            liquidityShare = amountA + amountB;
        } else {
            liquidityShare = (amountA + amountB) * lpToken.totalSupply() / totalLiquidity;
        }

        totalLiquidity += amountA + amountB;

        lpToken.mint(msg.sender, liquidityShare);
    }
    
    function withdrawFees(address _token, uint256 amount) public onlyOwner {
        IFeeCollector(feeCollector).withdrawFees(_token, amount);
    }

}