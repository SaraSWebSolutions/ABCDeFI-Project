// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";

/**
 * @title PopulationOracle
 * @notice On-chain population data oracle for ABCDeFi Franchise NFT dynamic pricing.
 *         Formula specified by founder: Price (USD) = (Population / 10,000) * $1,000
 */
contract PopulationOracle is AccessControl, Pausable {
    bytes32 public constant ORACLE_UPDATER_ROLE = keccak256("ORACLE_UPDATER_ROLE");

    // Price per 10,000 population unit = $1,000 USD
    uint256 public constant BASE_PRICE_PER_UNIT_USD = 1000;
    uint256 public constant POPULATION_UNIT = 10000;

    // territoryCode => population count
    mapping(string => uint256) private _territoryPopulation;

    event PopulationUpdated(string indexed territoryCode, uint256 oldPopulation, uint256 newPopulation);

    constructor(address admin) {
        if (admin == address(0)) revert Errors.InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_UPDATER_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);
    }

    /**
     * @notice Set or update population for a territory code.
     */
    function setPopulation(string calldata territoryCode, uint256 population)
        external
        onlyRole(ORACLE_UPDATER_ROLE)
        whenNotPaused
    {
        if (bytes(territoryCode).length == 0) revert Errors.InvalidParameter("Territory code empty");
        if (population == 0) revert Errors.ZeroAmount();

        uint256 oldPop = _territoryPopulation[territoryCode];
        _territoryPopulation[territoryCode] = population;

        emit PopulationUpdated(territoryCode, oldPop, population);
    }

    /**
     * @notice Get current population for a territory.
     */
    function getPopulation(string calldata territoryCode) external view returns (uint256) {
        return _territoryPopulation[territoryCode];
    }

    /**
     * @notice Calculate dynamic Franchise NFT price in USD using founder formula:
     *         Price = (Population / 10,000) * $1,000
     */
    function calculatePriceUSD(string calldata territoryCode) external view returns (uint256) {
        uint256 pop = _territoryPopulation[territoryCode];
        if (pop == 0) return BASE_PRICE_PER_UNIT_USD; // Default minimum $1,000

        // Price = (Population / 10,000) * 1,000
        uint256 price = (pop * BASE_PRICE_PER_UNIT_USD) / POPULATION_UNIT;
        return price < BASE_PRICE_PER_UNIT_USD ? BASE_PRICE_PER_UNIT_USD : price;
    }

    /**
     * @notice Direct formula calculation helper for arbitrary population.
     */
    function calculatePriceForPopulation(uint256 population) pure external returns (uint256) {
        if (population == 0) return BASE_PRICE_PER_UNIT_USD;
        uint256 price = (population * BASE_PRICE_PER_UNIT_USD) / POPULATION_UNIT;
        return price < BASE_PRICE_PER_UNIT_USD ? BASE_PRICE_PER_UNIT_USD : price;
    }
}
