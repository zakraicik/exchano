// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LPToken is ERC20 {
    address public tokenFlowContract;

    constructor() ERC20("TokenFlow LP Token", "TFLP") {
        tokenFlowContract = msg.sender;
    }

    modifier onlyTokenFlow() {
        require(msg.sender == tokenFlowContract, "Not authorized");
        _;
    }

    function mint(address to, uint256 amount) external onlyTokenFlow {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyTokenFlow {
        _burn(from, amount);
    }
}
