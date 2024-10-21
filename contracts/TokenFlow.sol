// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IFeeCollector {
    function withdrawFees(address token, uint256 amount) external;
}

contract TokenFlow {
    uint256 public feeRate; 
    address public owner;
    address public feeCollector;

    constructor(address _feeCollector, uint256 _feeRate) {
        feeCollector = _feeCollector;
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
        IERC20 tokenA = IERC20(_tokenA);
        IERC20 tokenB = IERC20(_tokenB);

        require(tokenA.transferFrom(msg.sender, address(this), amountA), "Transfer of token A failed");
        require(tokenB.transferFrom(msg.sender, address(this), amountB), "Transfer of token B failed");
    }
    
    function withdrawFees(address _token, uint256 amount) public onlyOwner {
        IFeeCollector(feeCollector).withdrawFees(_token, amount);
    }

}