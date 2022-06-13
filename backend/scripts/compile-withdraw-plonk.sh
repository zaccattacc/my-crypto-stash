#!/bin/bash

cd circuits

mkdir withdraw_plonk

if [ -f ./powersOfTau28_hez_final_16.ptau ]; then
    echo "powersOfTau28_hez_final_16.ptau already exists. Skipping."
else
    echo 'Downloading powersOfTau28_hez_final_16.ptau'
    wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau
fi

echo "Compiling withdraw.circom"

#compile Circuit

circom withdraw.circom --r1cs --wasm --sym -o withdraw_plonk
snarkjs r1cs info withdraw_plonk/withdraw.r1cs

# Start a new zkey and make a contribution

snarkjs plonk setup withdraw_plonk/withdraw.r1cs powersOfTau28_hez_final_16.ptau withdraw_plonk/circuit_final.zkey
snarkjs zkey verify withdraw_plonk/withdraw.r1cs powersOfTau28_hez_final_16.ptau withdraw_plonk/circuit_final.zkey
snarkjs zkey export verificationkey withdraw_plonk/circuit_final.zkey withdraw_plonk/verification_key.json

# generate solidity contract

snarkjs zkey export solidityverifier withdraw_plonk/circuit_final.zkey ../contracts/Verifier.sol

cd ..