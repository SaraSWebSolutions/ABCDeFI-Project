// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../libraries/ABCDTokenV2Constants.sol";

/**
 * Clean owner-approved 1Q deployment. ABCDToken (the 1B/eight-role ABI) is
 * intentionally preserved as a historical deployment and is not upgraded.
 */
contract ABCDTokenV2 is ERC20, ERC20Burnable, ERC20Pausable, ERC20Permit, AccessControl, Ownable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    address public immutable icoWallet;
    address public immutable founderWallet;
    address public immutable marketingWallet;
    address public immutable advisorsWallet;
    address public immutable financeResourceWallet;
    address public immutable contingencyWallet;
    address public immutable reserveWallet;
    address private _treasury;
    event AllocationWalletsConfigured(address indexed ico, address indexed founder, address marketing, address advisors, address financeResource, address contingency, address reserve);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    constructor(address ico, address founder, address marketing, address advisors, address financeResource, address contingency, address reserve)
        ERC20("ABCDeFi Core Token", "ABCD") ERC20Permit("ABCDeFi Core Token") Ownable(msg.sender) {
        if (ico == address(0) || founder == address(0) || marketing == address(0) || advisors == address(0) || financeResource == address(0) || contingency == address(0) || reserve == address(0)) revert("Invalid allocation wallet");
        icoWallet=ico; founderWallet=founder; marketingWallet=marketing; advisorsWallet=advisors; financeResourceWallet=financeResource; contingencyWallet=contingency; reserveWallet=reserve; _treasury=financeResource;
        _grantRole(DEFAULT_ADMIN_ROLE,msg.sender); _grantRole(MINTER_ROLE,msg.sender); _grantRole(BURNER_ROLE,msg.sender); _grantRole(PAUSER_ROLE,msg.sender); _grantRole(TREASURY_ROLE,financeResource);
        _mint(ico, allocation(ABCDTokenV2Constants.ICO_BPS)); _mint(founder, allocation(ABCDTokenV2Constants.FOUNDER_BPS)); _mint(marketing, allocation(ABCDTokenV2Constants.MARKETING_BPS)); _mint(advisors, allocation(ABCDTokenV2Constants.ADVISORS_BPS)); _mint(financeResource, allocation(ABCDTokenV2Constants.FINANCE_RESOURCE_BPS)); _mint(contingency, allocation(ABCDTokenV2Constants.CONTINGENCY_BPS)); _mint(reserve, allocation(ABCDTokenV2Constants.RESERVE_BPS));
        require(totalSupply() == ABCDTokenV2Constants.MAX_SUPPLY, "Allocation mismatch"); emit AllocationWalletsConfigured(ico, founder, marketing, advisors, financeResource, contingency, reserve); emit TreasuryUpdated(address(0), financeResource);
    }
    function allocation(uint256 bps) public pure returns(uint256) { return ABCDTokenV2Constants.MAX_SUPPLY * bps / ABCDTokenV2Constants.BPS_DENOMINATOR; }
    function maxSupply() external pure returns(uint256) { return ABCDTokenV2Constants.MAX_SUPPLY; }
    function treasury() external view returns(address) { return _treasury; }
    function mint(address to,uint256 amount) external onlyRole(MINTER_ROLE) { require(to != address(0) && amount != 0, "Invalid mint"); require(totalSupply()+amount<=ABCDTokenV2Constants.MAX_SUPPLY,"Max supply exceeded"); _mint(to,amount); }
    function burnFromTreasury(uint256 amount) external { require(hasRole(BURNER_ROLE,msg.sender)||hasRole(TREASURY_ROLE,msg.sender),"Unauthorized"); require(amount != 0,"Zero amount"); _burn(_treasury,amount); }
    function setTreasury(address newTreasury) external onlyOwner { require(newTreasury!=address(0),"Invalid treasury"); address old=_treasury; _treasury=newTreasury; _revokeRole(TREASURY_ROLE,old); _grantRole(TREASURY_ROLE,newTreasury); emit TreasuryUpdated(old,newTreasury); }
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
    function _update(address from,address to,uint256 value) internal override(ERC20,ERC20Pausable) { super._update(from,to,value); }
}
