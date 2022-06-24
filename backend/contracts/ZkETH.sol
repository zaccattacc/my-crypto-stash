pragma solidity >= 0.5.0 < 0.8.13;
pragma experimental ABIEncoderV2;

import "@aztec/protocol/contracts/ERC1724/ZkAssetAdjustable.sol";
import "@aztec/protocol/contracts/interfaces/IACE.sol";

contract ZkETH is ZkAssetAdjustable {

    IACE ace;

    struct Account {
        address owner;
        bytes publicKey;
    }

    event PublicKey(address indexed owner, bytes key);

    constructor(
        address _aceAddress,
        address _linkedToken,
        uint64 _scalingFactor
        ) public ZkAssetAdjustable(_aceAddress, _linkedToken, _scalingFactor, 0, abi.encodePacked(uint(0))) {
            ace = IACE(_aceAddress);
    }

    function register(Account memory _account) public {
        require(_account.owner == msg.sender, "only owner can be registered");
        _register(_account);
    }

    function _register(Account memory _account) internal {
        emit PublicKey(_account.owner, _account.publicKey);
    }

}