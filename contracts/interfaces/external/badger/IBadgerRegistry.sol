// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

enum VaultStatus { experimental, guarded, open }

interface IBadgerRegistry{
    function getFilteredProductionVaults(string memory version, VaultStatus status) external view returns (address[] memory);
}