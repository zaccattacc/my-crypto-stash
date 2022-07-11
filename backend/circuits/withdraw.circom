pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/switcher.circom";

template MerkleTreeInclusionProof(n) {
    signal input leaf;
    signal input path_elements[n];
    signal input path_index[n]; // path index are 0's and 1's indicating whether the current element is on the left or right
    signal input root; 

    component hasher[n]; // hashes at every level
    component l_r[n]; 
    var hash = leaf;

    for(var i = 0; i < n; i++){
        l_r[i] = Switcher(); // switches at every level depending on the path_index
        l_r[i].sel <== path_index[i];
        l_r[i].L <== hash;
        l_r[i].R <== path_elements[i];

        hasher[i] = Poseidon(2);
        hasher[i].inputs[0] <== l_r[i].outL;
        hasher[i].inputs[1] <== l_r[i].outR;

        hash = hasher[i].out; // updates the hash for every level
    }   

    root === hash; // the final hash should be the root of the merkle tree

}

template Withdraw(levels) {
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input relayer;
    signal input fee;
    signal input withdrawAmount;
    signal input amount;
    signal input nullifier;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component leafIndexNum = Bits2Num(levels);
    for (var i = 0; i < levels; i++) {
        leafIndexNum.in[i] <== pathIndices[i];
    }

    component nullifierHasher = Poseidon(3);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHasher.inputs[1] <== 1;
    nullifierHasher.inputs[2] <== leafIndexNum.out;
    nullifierHasher.out === nullifierHash;

    component commitmentHasher = Poseidon(3);
    commitmentHasher.inputs[0] <== nullifier;
    commitmentHasher.inputs[1] <== secret;
    commitmentHasher.inputs[2] <== amount;

    component tree = MerkleTreeInclusionProof(levels);
    tree.leaf <== commitmentHasher.out;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.path_elements[i] <== pathElements[i];
        tree.path_index[i] <== pathIndices[i];
    }

    component checker = GreaterEqThan(96);
    checker.in[0] <== amount;
    checker.in[1] <== withdrawAmount;
    
    checker.out === 1;


    signal recipientSquare <== recipient * recipient;
    signal feeSquare <== fee * fee;
    signal relayerSquare <== relayer * relayer;
}

component main {public [root, nullifierHash, recipient, relayer, fee, withdrawAmount]} = Withdraw(20);