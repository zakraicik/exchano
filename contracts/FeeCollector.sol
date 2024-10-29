// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FeeCollector is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct UserShare {
        uint256 lastUpdateBlock;
        uint256 accumulatedShare; 
    }

    // token => user => share info
    mapping(address => mapping(address => UserShare)) public userShares;
    // token => total accumulated fees
    mapping(address => uint256) public totalFeesCollected;
    
    address public exchano;

    event FeesReceived(address indexed token, uint256 amount);
    event FeesWithdrawn(address indexed user, address indexed token, uint256 amount);
    event UserShareUpdated(address indexed user, address indexed token, uint256 newShare);
    event TokensRecovered(address indexed token, uint256 amount);
    event ExchanoUpdated(address indexed oldExchano, address indexed newExchano);

    modifier onlyExchano() {
        require(msg.sender == exchano, "Only Exchano can call");
        _;
    }

    constructor(address _exchano) Ownable(msg.sender) {
        require(_exchano != address(0), "Zero address");
        exchano = _exchano;
    }

    function setExchano(address _newExchano) external onlyOwner {
        require(_newExchano != address(0), "Zero address");
        address oldExchano = exchano;
        exchano = _newExchano;
        emit ExchanoUpdated(oldExchano, _newExchano);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function receiveFees(address token, uint256 amount) external onlyExchano whenNotPaused {
        require(token != address(0), "Zero address token");
        require(amount > 0, "Zero amount");
        totalFeesCollected[token] += amount;
        emit FeesReceived(token, amount);
    }

    function updateUserShare(
        address user,
        address token,
        uint256 newShareBasisPoints
    ) external onlyExchano whenNotPaused {
        require(user != address(0), "Zero address user");
        require(token != address(0), "Zero address token");
        require(newShareBasisPoints <= 10000, "Share exceeds 100%");
        
        userShares[token][user].lastUpdateBlock = block.number;
        userShares[token][user].accumulatedShare = newShareBasisPoints;
        emit UserShareUpdated(user, token, newShareBasisPoints);
    }

    function getUserFeesForToken(
        address user,
        address token
    ) external view returns (uint256) {
        UserShare memory share = userShares[token][user];
        if (share.accumulatedShare == 0) return 0;
        
        uint256 totalFees = totalFeesCollected[token];
        return (totalFees * share.accumulatedShare) / 10000;
    }

    function withdrawUserFees(
        address user,
        address token,
        uint256 shareInBasisPoints
    ) external nonReentrant whenNotPaused {
        require(msg.sender == exchano, "Only Exchano can trigger withdrawals");
        require(shareInBasisPoints <= 10000, "Invalid share");
        require(token != address(0), "Zero address token");
        require(user != address(0), "Zero address user");

        UserShare storage share = userShares[token][user];
        require(share.accumulatedShare > 0, "No share");
        require(share.lastUpdateBlock < block.number, "Same block protection");

        uint256 totalFees = totalFeesCollected[token];
        uint256 userFees = (totalFees * shareInBasisPoints) / 10000;
        
        if (userFees > 0) {
            share.accumulatedShare = 0;
            share.lastUpdateBlock = block.number;
            totalFeesCollected[token] -= userFees;
            
            IERC20(token).safeTransfer(user, userFees);
            emit FeesWithdrawn(user, token, userFees);
        }
    }

    function recoverTokens(address token) external onlyOwner {
        require(token != address(0), "Zero address token");
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(owner(), balance);
            emit TokensRecovered(token, balance);
        }
    }
}