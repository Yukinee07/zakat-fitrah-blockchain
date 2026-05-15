// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IZakatFitrah {
    function distributeFunds(
        address[] calldata beneficiaries,
        uint256[] calldata amounts
    ) external;
}

/// @dev Helper contract used ONLY in tests to verify reentrancy protection.
contract ReentrancyAttacker {
    IZakatFitrah public immutable target;
    address[]    private _addrs;
    uint256[]    private _amounts;

    constructor(address _target) {
        target = IZakatFitrah(_target);
        _addrs   = new address[](1);
        _amounts = new uint256[](1);
        _addrs[0]   = address(this);
        _amounts[0] = 0.001 ether;
    }

    receive() external payable {
        // Attempt to reenter distributeFunds.
        target.distributeFunds(_addrs, _amounts);
    }
}
