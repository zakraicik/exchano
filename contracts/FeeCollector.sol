// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract FeeCollector {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function withdrawFees( address token, uint256 amount) external {
        
        IERC20(token).transfer(owner, amount);
    }

}
