pragma solidity >= 0.5.0 < 0.8.13;

import "@aztec/protocol/contracts/ERC1724/ZkAssetAdjustable.sol";
import "@aztec/protocol/contracts/interfaces/IACE.sol";

contract ZkETH is ZkAssetAdjustable {

    IACE ace;

    constructor(
        address _aceAddress,
        address _linkedToken,
        uint64 _scalingFactor
        ) public ZkAssetAdjustable(_aceAddress, _linkedToken, _scalingFactor, 0, abi.encodePacked(uint(0))) {}


    function update(uint24 _proof, bytes memory data, address sender) public {

        ace.updateNoteRegistry(_proof, data, sender);
    }
}