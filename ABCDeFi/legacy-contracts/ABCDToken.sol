// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ABCD Token with predefined allocations
/// @notice Mints the total supply and distributes according to the whitepaper percentages
contract ABCDToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @param name_ Token name
    /// @param symbol_ Token symbol
    /// @param totalSupply_ Total token supply expressed in smallest units (wei)
    /// @param founder Founder allocation receiver (55%)
    /// @param ico ICO allocation receiver (20%)
    /// @param partnerships Partnerships allocation receiver (10%)
    /// @param finance Finance resource allocation receiver (9%)
    /// @param advisors Advisors allocation receiver (2%)
    /// @param reserveAddr Reserve allocation receiver (2%)
    /// @param contingency Contingency allocation receiver (2%)
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        address founder,
        address ico,
        address partnerships,
        address finance,
        address advisors,
        address reserveAddr,
        address contingency
    ) ERC20(name_, symbol_) {
        require(founder != address(0) && ico != address(0), "invalid address");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        uint256 total = totalSupply_;

        _mint(founder, (total * 55) / 100);
        _mint(ico, (total * 20) / 100);
        _mint(partnerships, (total * 10) / 100);
        _mint(finance, (total * 9) / 100);
        _mint(advisors, (total * 2) / 100);
        _mint(reserveAddr, (total * 2) / 100);
        _mint(contingency, (total * 2) / 100);
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
