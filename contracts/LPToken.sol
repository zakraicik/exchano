// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LPToken is ERC20 {
    address public liquidityPool;

    constructor(string memory name, string memory symbol, address _liquidityPool) ERC20(name, symbol) {
        liquidityPool = _liquidityPool;
    }

    modifier onlyLiquidityPool() {
        require(msg.sender == liquidityPool, "Not authorized");
        _;
    }

    function mint(address to, uint256 amount) external onlyLiquidityPool {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyLiquidityPool {
        _burn(from, amount);
    }
}
